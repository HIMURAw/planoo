// Flat Canvas Node store (Zustand) — tek kaynak-of-truth olarak
// `Record<string, CanvasNode>` + `rootIds: string[]` tutar, hiyerarşiyi
// `parentId`/`children` referanslarıyla yönetir (bkz. src/types/canvas.ts).
//
// PERFORMANS SÖZLEŞMESİ (transient updates): Sürükleme/boyutlandırma
// SIRASINDA bu store'a HİÇ dokunulmamalı — her piksel hareketinde `set()`
// çağırmak tüm subscriber'ları tetikler. Bunun yerine sürükleyen bileşen,
// kendi local ref'i üzerinden DOM elemanının `transform: translate3d(...)`
// stilini doğrudan günceller; store'a TEK bir yazma, sürükleme bitince
// (`onDragEnd`/`onResizeEnd`) `updateNodePosition`/`updateNode` ile yapılır.
// Örnek kullanım (tüketici tarafı, bu dosyanın parçası değil):
//
//   function onPointerMove(e: PointerEvent) {
//     nodeRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
//   }
//   function onPointerUp() {
//     useCanvasStore.getState().updateNodePosition(id, finalX, finalY);
//   }
//
// `useCanvasStore.getState()` React render döngüsünün dışında, herhangi bir
// yeniden render'a yol açmadan imperatif çağrılabilir — Zustand'ın hook'u
// aynı zamanda kendi `getState`/`setState`/`subscribe` metodlarını taşır.
"use client";

import { create } from "zustand";
import type { CanvasNode, CanvasState } from "@/types/canvas";

function bucketFor(state: CanvasState, parentId: string | null): string[] {
  return parentId === null ? state.rootIds : (state.nodes[parentId]?.children ?? []);
}

// `parentId`'nin (ya da kök seviyeyse rootIds'in) children dizisini `next`
// ile değiştirilmiş hâliyle yeni bir state dilimi üretir. `nodes` ve
// `rootIds` alanlarının İKİSİNİ DE her zaman döndürür ki çağıran taraf
// sonucu doğrudan (ekstra spread'e gerek kalmadan) state'e uygulayabilsin.
function withBucket(state: CanvasState, parentId: string | null, next: string[]): CanvasState {
  if (parentId === null) return { nodes: state.nodes, rootIds: next };
  const parent = state.nodes[parentId];
  if (!parent) return state;
  return { nodes: { ...state.nodes, [parentId]: { ...parent, children: next } }, rootIds: state.rootIds };
}

// id'nin TÜM alt ağacını (kendisi dahil) toplar. `children` dizisi
// sayesinde O(n) — mevcut sistemdeki (React state tabanlı) eşdeğeri, sabit
// nokta bulunana kadar TÜM node listesini tekrar tekrar tarıyordu (O(n²)).
export function collectDescendantIds(nodes: Record<string, CanvasNode>, id: string): Set<string> {
  const result = new Set<string>([id]);
  const stack = [id];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const current = nodes[currentId];
    if (!current) continue;
    for (const childId of current.children) {
      if (!result.has(childId)) {
        result.add(childId);
        stack.push(childId);
      }
    }
  }
  return result;
}

// targetId, candidateId'nin kendisi mi ya da onun (doğrudan/dolaylı) bir alt
// öğesi mi? `candidateId`'yi `targetId`'nin yeni ebeveyni yapmak bir döngü
// (cycle) oluşturur mu diye `setParent` içinde kullanılır.
export function isSelfOrDescendant(nodes: Record<string, CanvasNode>, candidateId: string, targetId: string): boolean {
  if (candidateId === targetId) return true;
  let current = nodes[targetId];
  while (current?.parentId) {
    if (current.parentId === candidateId) return true;
    current = nodes[current.parentId];
  }
  return false;
}

export interface CanvasActions {
  // Sunucudan/ilk yüklemeden gelen DÜZ dizi (her node kendi parentId'sini
  // taşır, `children` YOK) — store burada children dizilerini TÜRETİR ve
  // invariant'ı ilk kez kurar. Mevcut /api/design/elements route'ları hiç
  // değişmeden bu fonksiyona beslenebilir. Giriş dizisi topolojik sıralı
  // olmak ZORUNDA değildir (bir çocuk, ebeveyninden önce gelebilir).
  hydrate: (flatNodes: Omit<CanvasNode, "children">[]) => void;
  addNode: (node: Omit<CanvasNode, "children">, index?: number) => void;
  removeNode: (id: string) => void;
  updateNode: (id: string, patch: Partial<Omit<CanvasNode, "id" | "parentId" | "children">>) => void;
  // Sürükleme/boyutlandırma bitince TEK bir commit yapmak için — bkz. dosya
  // başındaki performans sözleşmesi.
  updateNodePosition: (id: string, posX: number, posY: number) => void;
  // `newParentId: null` → kök seviyeye taşı. Döngü oluşturacak bir taşıma
  // (kendi alt öğesine ebeveynlik) veya var olmayan bir hedef sessizce
  // reddedilir (no-op) — çağıran taraf gerekirse önceden
  // `isSelfOrDescendant` ile kendi UI geri bildirimini verebilir.
  setParent: (id: string, newParentId: string | null, index?: number) => void;
  // Aynı ebeveyn İÇİNDE sıralamayı değiştirir (katmanlar panelinde
  // sürükle-bırak yeniden sıralama için).
  reorderChild: (parentId: string | null, id: string, index: number) => void;
  reset: () => void;
}

export type CanvasStore = CanvasState & CanvasActions;

const EMPTY_STATE: CanvasState = { nodes: {}, rootIds: [] };

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  ...EMPTY_STATE,

  hydrate(flatNodes) {
    const nodes: Record<string, CanvasNode> = {};
    for (const n of flatNodes) nodes[n.id] = { ...n, children: [] } as CanvasNode;
    const rootIds: string[] = [];
    for (const n of flatNodes) {
      if (n.parentId && nodes[n.parentId]) nodes[n.parentId].children.push(n.id);
      else rootIds.push(n.id);
    }
    set({ nodes, rootIds });
  },

  addNode(node, index) {
    set((state) => {
      const full: CanvasNode = { ...node, children: [] } as CanvasNode;
      const withNode: CanvasState = { nodes: { ...state.nodes, [full.id]: full }, rootIds: state.rootIds };
      const bucket = bucketFor(withNode, full.parentId);
      const nextBucket = [...bucket];
      nextBucket.splice(index ?? nextBucket.length, 0, full.id);
      return withBucket(withNode, full.parentId, nextBucket);
    });
  },

  removeNode(id) {
    set((state) => {
      const node = state.nodes[id];
      if (!node) return state;
      const idsToRemove = collectDescendantIds(state.nodes, id);
      const nodes = { ...state.nodes };
      for (const removedId of idsToRemove) delete nodes[removedId];
      const withoutRemoved: CanvasState = { nodes, rootIds: state.rootIds };
      const bucket = bucketFor(withoutRemoved, node.parentId).filter((childId) => childId !== id);
      return withBucket(withoutRemoved, node.parentId, bucket);
    });
  },

  updateNode(id, patch) {
    set((state) => {
      const node = state.nodes[id];
      if (!node) return state;
      return { nodes: { ...state.nodes, [id]: { ...node, ...patch } }, rootIds: state.rootIds };
    });
  },

  updateNodePosition(id, posX, posY) {
    get().updateNode(id, { posX, posY });
  },

  setParent(id, newParentId, index) {
    set((state) => {
      const node = state.nodes[id];
      if (!node || node.parentId === newParentId || id === newParentId) return state;
      if (newParentId !== null && (!state.nodes[newParentId] || isSelfOrDescendant(state.nodes, id, newParentId))) {
        return state;
      }

      const oldBucket = bucketFor(state, node.parentId).filter((childId) => childId !== id);
      const afterRemoval = withBucket(state, node.parentId, oldBucket);

      const newBucket = [...bucketFor(afterRemoval, newParentId)];
      newBucket.splice(index ?? newBucket.length, 0, id);
      const afterInsertion = withBucket(afterRemoval, newParentId, newBucket);

      return {
        nodes: { ...afterInsertion.nodes, [id]: { ...afterInsertion.nodes[id], parentId: newParentId } },
        rootIds: afterInsertion.rootIds,
      };
    });
  },

  reorderChild(parentId, id, index) {
    set((state) => {
      const bucket = bucketFor(state, parentId);
      if (!bucket.includes(id)) return state;
      const without = bucket.filter((childId) => childId !== id);
      const next = [...without];
      next.splice(Math.max(0, Math.min(index, next.length)), 0, id);
      return withBucket(state, parentId, next);
    });
  },

  reset() {
    set(EMPTY_STATE);
  },
}));

// Narrow, seçici (selector) abonelikler — bir bileşen SADECE tek bir node'a
// abone olursa, o node dışındaki her şey değiştiğinde yeniden render OLMAZ.
// Bu, "sürükleme dışında da gereksiz re-render'ları önlemek" hedefine
// hizmet eden, store'un asıl performans kazancı olan kısmı.
export function useCanvasNode(id: string): CanvasNode | undefined {
  return useCanvasStore((state) => state.nodes[id]);
}

export function useCanvasChildren(parentId: string | null): string[] {
  return useCanvasStore((state) => (parentId === null ? state.rootIds : (state.nodes[parentId]?.children ?? [])));
}

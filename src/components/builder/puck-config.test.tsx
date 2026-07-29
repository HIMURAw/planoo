import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Puck, type Data } from "@puckeditor/core";
import { puckConfig, type BuilderComponents } from "./puck-config";

// isCanvas/slot davranışının, `inline`+`puck.dragRef` kablolamasının ve her
// bileşenin varsayılan prop'larla gerçekten doğru render olduğunun tsc/lint
// dışında kanıtlanması için gerçek bir <Puck> mount'u kullanılıyor — Craft.js
// denemesinde de aynı yöntem izlenmişti.
function seededData(): Data<BuilderComponents> {
  return {
    root: {},
    zones: {},
    content: [
      {
        type: "Container",
        props: {
          id: "container-1",
          flexDirection: "row",
          justifyContent: "flex-start",
          alignItems: "stretch",
          gap: 8,
          paddingTop: 16,
          paddingRight: 16,
          paddingBottom: 16,
          paddingLeft: 16,
          radius: 4,
          background: "#ffffff",
          width: "auto",
          height: "auto",
          content: [
            {
              type: "Text",
              props: {
                id: "text-1",
                text: "Merhaba",
                fontSize: 16,
                fontWeight: "normal",
                color: "#111827",
                textAlign: "left",
              },
            },
            {
              type: "Button",
              props: {
                id: "button-1",
                text: "Gönder",
                background: "#7c3aed",
                color: "#ffffff",
                paddingX: 20,
                paddingY: 10,
                radius: 8,
                fontSize: 14,
                fontWeight: "medium",
                width: "auto",
              },
            },
          ],
        },
      },
    ],
  };
}

describe("puckConfig", () => {
  it("renders a nested Container > Text/Button tree with the configured props", () => {
    // Puck renders the canvas inside an iframe by default (CSS isolation
    // from the host app) — disabled here so the rendered tree is reachable
    // via plain DOM queries against the outer container. The real editor
    // (BuilderEditor.tsx) keeps the iframe enabled and instead syncs host
    // styles into it, which this test doesn't need to exercise.
    const { container } = render(
      <Puck config={puckConfig} data={seededData()} onChange={() => {}} iframe={{ enabled: false }} />,
    );

    // Container: flex + doğru stil değerleri
    const containerDiv = Array.from(container.querySelectorAll("div.flex")).find((el) =>
      el.classList.contains("flex-row"),
    ) as HTMLDivElement;
    expect(containerDiv).toBeTruthy();
    expect(containerDiv.classList.contains("items-stretch")).toBe(true);
    expect(containerDiv.style.paddingTop).toBe("16px");
    expect(containerDiv.style.borderRadius).toBe("4px");

    // Text ve Button, Container'ın İÇİNDE render olmuş mu (slot/nesting
    // gerçekten çalışıyor mu)
    expect(screen.getByText("Merhaba")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Gönder" });
    expect(containerDiv.contains(button)).toBe(true);
    expect((button as HTMLButtonElement).style.borderRadius).toBe("8px");
  });

  it("exposes all 4 components with defaultProps and a render function", () => {
    for (const name of ["Container", "Text", "Button", "Image"] as const) {
      const comp = puckConfig.components[name];
      expect(comp.defaultProps).toBeDefined();
      expect(typeof comp.render).toBe("function");
    }
  });
});

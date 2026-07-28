import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Editor, Frame, Element } from "@craftjs/core";
import { Container, CONTAINER_DEFAULT_PROPS } from "./Container";
import { Button } from "./Button";

// isCanvas: true'nun gerçekten davranışı olduğunu (Container'a bir çocuk
// bırakılabildiğini) kanıtlamak için tsc/lint yeterli değil — bu yüzden
// gerçek bir <Editor><Frame> ağacına mount ediyoruz, sadece tip kontrolüne
// güvenmek yerine.
function renderNestedTree() {
  return render(
    <Editor resolver={{ Container, Button }}>
      <Frame>
        <Element is={Container} canvas id="root-container">
          <Element is={Button} id="child-button" />
        </Element>
      </Frame>
    </Editor>,
  );
}

describe("Container", () => {
  it("renders a flex div with its default layout/spacing applied", () => {
    const { container } = renderNestedTree();
    const div = container.querySelector("div.flex") as HTMLDivElement;
    expect(div).not.toBeNull();
    expect(div.classList.contains("flex-col")).toBe(true);
    expect(div.classList.contains("items-stretch")).toBe(true);
    expect(div.classList.contains("justify-start")).toBe(true);
    expect(div.style.paddingTop).toBe(`${CONTAINER_DEFAULT_PROPS.paddingTop}px`);
    expect(div.style.paddingLeft).toBe(`${CONTAINER_DEFAULT_PROPS.paddingLeft}px`);
    expect(div.style.borderRadius).toBe(`${CONTAINER_DEFAULT_PROPS.radius}px`);
    expect(div.style.width).toBe(CONTAINER_DEFAULT_PROPS.width);
  });

  it("accepts a nested child node (proves isCanvas actually makes it droppable)", () => {
    renderNestedTree();
    expect(screen.getByText("Buton")).toBeInTheDocument();
  });

  it("exposes a related.settings component for the right-hand panel", () => {
    expect(Container.craft?.related?.settings).toBeDefined();
    expect(Container.craft?.isCanvas).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Editor, Frame, Element } from "@craftjs/core";
import { Button, BUTTON_DEFAULT_PROPS } from "./Button";

function renderButton() {
  return render(
    <Editor resolver={{ Button }}>
      <Frame>
        <Element is={Button} id="root-button" />
      </Frame>
    </Editor>,
  );
}

describe("Button", () => {
  it("renders as a real <button> with the default label and styles", () => {
    renderButton();
    const btn = screen.getByRole("button") as HTMLButtonElement;
    expect(btn).toHaveTextContent(BUTTON_DEFAULT_PROPS.text);
    expect(btn.style.borderRadius).toBe(`${BUTTON_DEFAULT_PROPS.radius}px`);
    expect(btn.style.fontSize).toBe(`${BUTTON_DEFAULT_PROPS.fontSize}px`);
    expect(btn.className).toContain("font-medium");
    expect(btn.className).toContain("w-auto");
  });

  it("makes its label contentEditable by default (editor starts enabled)", () => {
    renderButton();
    const label = screen.getByText(BUTTON_DEFAULT_PROPS.text);
    expect(label.getAttribute("contenteditable")).toBe("true");
  });

  it("exposes a related.settings component for the right-hand panel", () => {
    expect(Button.craft?.related?.settings).toBeDefined();
  });
});

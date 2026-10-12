import Phaser from "phaser";

export function floatingText(scene: Phaser.Scene, x: number, y: number, text: string, color: string, big = false) {
  const label = scene.add
    .text(Math.round(x + (Math.random() - 0.5) * 6), Math.round(y), text, {
      fontFamily: "Courier New, monospace",
      fontSize: big ? "11px" : "8px",
      fontStyle: "bold",
      color,
      stroke: "#000000",
      strokeThickness: 2,
    })
    .setOrigin(0.5, 1)
    .setResolution(4)
    .setDepth(200000);

  scene.tweens.add({
    targets: label,
    y: label.y - 14,
    alpha: { from: 1, to: 0 },
    ease: "Cubic.easeIn",
    duration: big ? 1300 : 900,
    onComplete: () => label.destroy(),
  });
}

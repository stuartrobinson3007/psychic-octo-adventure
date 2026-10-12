// Taller review frames keep a request and its resulting cards together.
export const reviewViewports = [
  { name: "mobile", label: "Mobile · 390", width: 390, height: 844 },
  { name: "tablet", label: "Tablet · 768", width: 768, height: 1024 },
  { name: "laptop", label: "Laptop · 1024", width: 1024, height: 1400 },
  { name: "desktop", label: "Desktop · 1440", width: 1440, height: 1600 },
]

export const reviewSheetSize = {
  width:
    reviewViewports.reduce((sum, viewport) => sum + viewport.width, 0) +
    (reviewViewports.length - 1) * 16,
  height: Math.max(...reviewViewports.map((viewport) => viewport.height)),
}

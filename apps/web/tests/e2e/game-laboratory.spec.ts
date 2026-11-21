import { expect, test } from "@playwright/test";
import { startPublicApi } from "../public-api-fixture";

let role: "admin" | "user" | null = "admin";
let closeApi: (() => Promise<void>) | undefined;
test.beforeAll(async () => { closeApi = await startPublicApi(() => role ? { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", displayName: "Tonho", role } : null); });
test.afterAll(async () => { await closeApi?.(); });
test.beforeEach(async ({context}) => {
  role = "admin";
  await context.addCookies([{name:"croebet-session",value:"laboratory-fixture",url:"http://127.0.0.1:3100"}]);
});

async function openSettings(page: import("@playwright/test").Page) {
  const button = page.getByRole("button", { name: "Configuração da mesa", exact: true });
  if (await button.getAttribute("aria-expanded") !== "true") await button.click();
}

test("configuração interna preserva cenários e paginação sem reduzir a largura da mesa", async ({ page }) => {
  await page.goto("/admin/jogos/laboratorio");
  const scene = page.getByTestId("laboratory-scene");
  await expect(scene.locator("canvas")).toBeVisible();
  const badge = page.getByTestId("local-seat");
  await expect(badge.getByText("Você", { exact: true })).toBeVisible();
  const sceneBox = (await scene.boundingBox())!, badgeBox = (await badge.boundingBox())!;
  expect(badgeBox.x - sceneBox.x).toBeLessThan(24);
  expect(sceneBox.y + sceneBox.height - badgeBox.y - badgeBox.height).toBeLessThan(24);
  await expect(page.locator("header").getByText("Laboratório de jogos", { exact: true })).toBeVisible();
  await expect(page.locator("header").getByText("Editar jogo", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Laboratório de jogos", exact: true })).toHaveClass("sr-only");
  await expect(page.locator("header").getByRole("link", { name: "Voltar para Jogos do admin", includeHidden: true })).toHaveAttribute("href", "/admin/jogos");
  await expect(page.getByRole("complementary", { name: "Configuração da mesa" })).toHaveCount(0);
  await openSettings(page);
  const panel = page.getByRole("complementary", { name: "Configuração da mesa" });
  await expect(scene.getByRole("complementary")).toBeVisible();
  for (const name of ["Observar jogador", "Cartas na mão", "Vez do jogador", "Escala das cartas", "Curvatura do leque", "Curvatura dos adversários", "Largura dos assentos"]) await expect(page.getByLabel(name, { exact: true })).toHaveCount(0);
  await panel.getByText("Cenários de teste", { exact: true }).click();
  await panel.getByRole("button", { name: "50 cartas", exact: true }).click();
  await panel.getByLabel("Jogadores", { exact: true }).fill("6");
  await panel.getByRole("button", { name: "Salvar configuração", exact: true }).click();
  await panel.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await panel.getByRole("button", { name: "Restaurar configuração", exact: true }).click();
  await expect(panel.getByLabel("Jogadores", { exact: true })).toHaveValue("6");
  await page.getByRole("button", { name: "Configuração da mesa", exact: true }).click();
  const handWindow = page.getByTestId("hand-window");
  const initial = await handWindow.textContent();
  await page.getByRole("button", { name: "Próximas", exact: true }).click();
  await expect(handWindow).not.toHaveText(initial!);
  await expect(handWindow).toHaveText(/^\d+–\d+ de 50$/);
  await expect(page.getByRole("button", { name: "Anteriores", exact: true })).toBeEnabled();
});

test("visitantes e contas comuns não acessam o laboratório", async ({ page }) => {
  for (const next of ["user", null] as const) {
    role = next;
    await page.goto("/admin/jogos/laboratorio");
    await expect(page.getByRole("heading", { name: "Laboratório de jogos" })).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(0);
  }
});


test("comprar e descartar pelo 3D, abrir contexto e operar por teclado", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/admin/jogos/laboratorio");
  const scene = page.getByTestId("laboratory-scene");
  const canvas = scene.locator("canvas");
  await expect(canvas).toBeVisible();
  // Use the actual camera projection to hit the deck and a card in the WebGL canvas.
  const { OrthographicCamera, Vector3 } = await import("three");
  const { handPlacements, worldHandPose } = await import("../../three/table/layout");
  const { resolveTableLayout } = await import("../../three/table/adaptive-layout");
  const { defaultSettings: settings } = await import("../../features/games/laboratory/model");
  const box = (await canvas.boundingBox())!;
  expect(Number(await canvas.getAttribute("width"))).toBeGreaterThanOrEqual(box.width * 1.45);
  const request = { players: settings.players, viewer: 0, counts: settings.counts, width: box.width, height: box.height,
    angle: settings.angle, deck: [settings.deckX, 0.035, settings.deckZ] as [number, number, number] };
  const { fit } = resolveTableLayout(request);
  const camera = new OrthographicCamera(fit.left, fit.right, fit.top, fit.bottom, 0.1, 250);
  camera.position.fromArray(fit.position); camera.lookAt(...fit.target); camera.updateMatrixWorld();
  const screen = (position: [number, number, number]) => {
    const point = new Vector3(...position).project(camera);
    return { x: box.x + (point.x + 1) / 2 * box.width, y: box.y + (1 - point.y) / 2 * box.height };
  };
  await expect(scene.getByRole("button", { name: "Comprar carta", exact: true })).toBeVisible();
  const deck = screen([settings.deckX, 0.035 + 103 * settings.pileHeight + 0.0022, settings.deckZ]);
  await page.mouse.click(deck.x, deck.y);
  await expect(scene).toHaveAttribute("aria-label", "Mesa 3D de teste · Deck: 103 · Descarte: 0");
  const boughtLayout = resolveTableLayout({ ...request, counts: settings.counts.map((count, seat) => seat === 0 ? count + 1 : count) });
  const card = screen(worldHandPose(handPlacements(8, boughtLayout.hands[0])[7], boughtLayout.localSeat).position);
  await page.mouse.click(card.x, card.y);
  await expect(scene).toHaveAttribute("aria-label", "Mesa 3D de teste · Deck: 103 · Descarte: 1");
  await page.mouse.click(deck.x, deck.y, { button: "right" });
  await expect(page.getByRole("menuitem", { name: "Embaralhar deck", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "Embaralhar deck", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Deck embaralhado.");
  const accessibleCard = scene.getByRole("button", { name: "Descartar carta 6, posição 7", exact: true });
  await accessibleCard.focus(); await accessibleCard.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Virar carta", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Carta virada.");
  await accessibleCard.focus(); await accessibleCard.press("Enter");
  await expect(scene).toHaveAttribute("aria-label", "Mesa 3D de teste · Deck: 103 · Descarte: 2");
  await scene.getByRole("button", { name: "Passar vez para Jogador 2", exact: true }).click();
  await expect(scene.getByRole("button", { name: "Passar vez para Jogador 2", exact: true })).toContainText("Vez deste jogador");
});

test("menu do deck permite distribuir, trocar e recolher sem botões externos", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/admin/jogos/laboratorio");
  const scene = page.getByTestId("laboratory-scene");
  await scene.getByRole("button", { name: "Ações do deck", exact: true }).click();
  await page.getByRole("menuitem", { name: "Distribuir cartas", exact: true }).click();
  await expect(scene).toHaveAttribute("aria-label", "Mesa 3D de teste · Deck: 100 · Descarte: 0");
  const card = scene.getByRole("button", { name: "Descartar carta 0, posição 1", exact: true });
  await card.focus(); await card.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Trocar com", exact: true }).click();
  await page.getByRole("menuitem", { name: "Jogador 2", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Cartas trocadas.");
  await scene.getByRole("button", { name: "Ações do deck", exact: true }).click();
  await page.getByRole("menuitem", { name: "Recolher cartas", exact: true }).click();
  await expect(scene).toHaveAttribute("aria-label", "Mesa 3D de teste · Deck: 132 · Descarte: 0");
  await expect(scene.getByRole("button", { name: /^Descartar carta/ })).toHaveCount(0);
  await expect(scene.getByRole("alert")).toHaveCount(0);
});


test("iluminação e sombras podem ser ajustadas, salvas e restauradas dentro da prévia", async ({ page }) => {
  await page.goto("/admin/jogos/laboratorio");
  await openSettings(page);
  const panel = page.getByRole("complementary", { name: "Configuração da mesa" });
  await panel.getByText("Iluminação", { exact: true }).click();
  const exposure = panel.getByRole("slider", { name: /^Exposição/ });
  await exposure.focus(); await exposure.press("Home");
  await expect(exposure).toHaveValue("0.5");
  await panel.getByText("Sombras", { exact: true }).click();
  const softness = panel.getByRole("slider", { name: /^Suavidade da sombra/ });
  await softness.focus(); await softness.press("End");
  await expect(softness).toHaveValue("12");
  await panel.getByRole("button", { name: "Salvar configuração", exact: true }).click();
  await panel.getByRole("button", { name: "Restaurar iluminação", exact: true }).click();
  await expect(exposure).toHaveValue("1");
  await expect(softness).toHaveValue("6");
  await panel.getByRole("button", { name: "Restaurar configuração", exact: true }).click();
  await expect(exposure).toHaveValue("0.5");
  await expect(softness).toHaveValue("12");
  await panel.getByRole("button", { name: "Sombras: ativadas", exact: true }).click();
  await expect(softness).toBeDisabled();
  await expect(panel.getByRole("slider", { name: /^Intensidade da sombra/ })).toBeDisabled();
});


test("catálogo usa título e retorno ao laboratório no navbar", async ({ page }) => {
  await page.goto("/admin/jogos/laboratorio/love-letter");
  await expect(page.locator("header").getByText("Cartas do Love Letter", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cartas do Love Letter", exact: true })).toHaveClass("sr-only");
  await expect(page.locator("header").getByRole("link", { name: "Voltar ao laboratório", includeHidden: true })).toHaveAttribute("href", "/admin/jogos/laboratorio");
});


test("deck pode ser arrastado e salvo, sem comprar nem ultrapassar a área visível", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/admin/jogos/laboratorio");
  const scene = page.getByTestId("laboratory-scene"), canvas = scene.locator("canvas");
  const grip = scene.getByRole("button", { name: "Mover deck", exact: true });
  await expect(grip).toBeVisible();
  await scene.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const { OrthographicCamera, Vector3 } = await import("three");
  const { resolveTableLayout } = await import("../../three/table/adaptive-layout");
  const { defaultSettings: settings } = await import("../../features/games/laboratory/model");
  const { fit, deckPosition } = resolveTableLayout({ players: settings.players, viewer: 0, counts: settings.counts,
    width: box.width, height: box.height, angle: settings.angle, deck: [settings.deckX, 0.035, settings.deckZ], deckRotation: settings.deckRotation });
  const camera = new OrthographicCamera(fit.left, fit.right, fit.top, fit.bottom, 0.1, 250);
  camera.position.fromArray(fit.position); camera.lookAt(...fit.target); camera.updateMatrixWorld();
  const point = new Vector3(deckPosition[0], 0.035 + 103 * settings.pileHeight + 0.0022, deckPosition[2]).project(camera);
  const x = box.x + (point.x + 1) / 2 * box.width, y = box.y + (1 - point.y) / 2 * box.height;
  const before = (await grip.boundingBox())!;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 60, y + 40, { steps: 8 }); await page.mouse.up();
  await expect(scene).toHaveAttribute("aria-label", "Mesa 3D de teste · Deck: 104 · Descarte: 0");
  await expect.poll(async () => (await grip.boundingBox())!.x).toBeGreaterThan(before.x + 40);
  await page.mouse.click(x + 60, y + 40);
  await expect(scene).toHaveAttribute("aria-label", "Mesa 3D de teste · Deck: 103 · Descarte: 0");
  await openSettings(page);
  const panel = page.getByRole("complementary", { name: "Configuração da mesa" });
  await panel.getByText("Deck e descarte", { exact: true }).click();
  await expect(panel.getByRole("button", { name: "Superior esquerdo", exact: true })).toHaveCount(0);
  await expect(panel.getByLabel("Posição horizontal do deck", { exact: true })).toHaveCount(0);
  await panel.getByLabel("Rotação do deck", { exact: true }).fill("-25");
  await panel.getByRole("button", { name: "Salvar configuração", exact: true }).click();
  await page.getByRole("button", { name: "Configuração da mesa", exact: true }).click();
  const saved = (await grip.boundingBox())!;
  await grip.focus(); await grip.press("Shift+ArrowLeft");
  await expect.poll(async () => (await grip.boundingBox())!.x).toBeLessThan(saved.x - 15);
  await openSettings(page);
  await panel.getByRole("button", { name: "Restaurar configuração", exact: true }).click();
  await expect(panel.getByLabel("Rotação do deck", { exact: true })).toHaveValue("-25");
  await page.getByRole("button", { name: "Configuração da mesa", exact: true }).click();
  await expect.poll(async () => Math.abs((await grip.boundingBox())!.x - saved.x)).toBeLessThan(2);
  const frame = (await scene.boundingBox())!;
  for (const [dx, dy] of [[-500, -500], [500, -500], [-500, 500], [500, 500]]) {
    const handle = (await grip.boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
    await page.mouse.move(dx < 0 ? frame.x + dx : frame.x + frame.width + dx, dy < 0 ? frame.y + dy : frame.y + frame.height + dy, { steps: 10 });
    await page.mouse.up();
    const controls = (await grip.locator("..").boundingBox())!;
    expect(controls.x).toBeGreaterThanOrEqual(frame.x);
    expect(controls.y).toBeGreaterThanOrEqual(frame.y);
    expect(controls.x + controls.width).toBeLessThanOrEqual(frame.x + frame.width);
    expect(controls.y + controls.height).toBeLessThanOrEqual(frame.y + frame.height);
    await expect(scene).toHaveAttribute("aria-label", "Mesa 3D de teste · Deck: 104 · Descarte: 0");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(grip).toBeVisible();
});

test("layout se adapta sozinho ao mudar participantes, cartas e largura", async ({ page }) => {
  await page.goto("/admin/jogos/laboratorio");
  await openSettings(page);
  const panel = page.getByRole("complementary", { name: "Configuração da mesa" });
  await expect(panel.getByText("Layout automático conforme cartas, jogadores e espaço disponível.")).toBeVisible();
  await panel.getByLabel("Jogadores", { exact: true }).fill("12");
  await panel.getByText("Cenários de teste", { exact: true }).click();
  await panel.getByRole("button", { name: "50 cartas", exact: true }).click();
  await page.getByRole("button", { name: "Configuração da mesa", exact: true }).click();
  const handWindow = page.getByTestId("hand-window");
  await expect(handWindow).toHaveText(/^\d+–\d+ de 50$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(handWindow).toHaveText(/^\d+–\d+ de 50$/);
  await page.getByRole("button", { name: "Próximas", exact: true }).click();
  await expect(page.getByRole("button", { name: "Anteriores", exact: true })).toBeEnabled();
  const card = page.getByRole("button", { name: /^Descartar carta/ }).first();
  await card.focus(); await card.press("Enter");
  await expect(handWindow).toHaveText(/^\d+–\d+ de 49$/);
  await expect(page.getByTestId("laboratory-scene").getByRole("alert")).toHaveCount(0);
});

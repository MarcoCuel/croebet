import { expect, test, type Page } from "@playwright/test";

async function account(page: Page, username: string, path: string) {
  await page.goto("/");
  await page.evaluate(
    (name) => localStorage.setItem("croebet:demo-username", name),
    username,
  );
  await page.goto(path);
  await page.reload();
  await expect(
    page.getByRole("button", { name: `Conta de ${username}` }).last(),
  ).toBeVisible();
}
async function bet(page: Page, outcome: string, stake: string) {
  await page.getByRole("button", { name: outcome, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor em Croins").fill(stake);
  await dialog
    .getByRole("button", { name: "Confirmar aposta", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
}

test("admin encerra, apura e paga um rateio real sem duplicação após recarregar", async ({
  page,
}) => {
  await account(page, "Ana", "/apostas");
  await bet(page, "Sim", "10");
  await account(page, "Beto", "/apostas");
  await bet(page, "Não", "30");
  await account(page, "AdminTeste", "/admin/apostas/peruca");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Seções da aposta" })
    .getByRole("button", { name: "Participantes", exact: true })
    .click();
  await expect(page.getByRole("table")).toContainText("Ana");
  await expect(page.getByRole("table")).toContainText("Beto");
  await page
    .getByRole("button", { name: "Encerrar apostas", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar encerramento", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Seções da aposta" })
    .getByRole("button", { name: "Finalização", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Resultado da aposta" })
    .getByRole("button", { name: "Sim", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apurar resultado", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar apuração", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("navigation", { name: "Seções da aposta" })
    .getByRole("button", { name: "Finalização", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Pagar vencedores", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar pagamento", exact: true })
    .click();
  await expect(
    page.getByText("Liquidação concluída.", { exact: true }).first(),
  ).toBeVisible();
  const balances = () =>
    page.evaluate(() =>
      ["ana", "beto"].map(
        (name) =>
          JSON.parse(
            localStorage.getItem(`croebet:demo-wallet:${name}`) ?? "{}",
          ).balance,
      ),
    );
  expect(await balances()).toEqual([1097, 1037]);
  await page.reload();
  expect(await balances()).toEqual([1097, 1037]);
  await expect(
    page.getByRole("button", { name: "Pagar vencedores", exact: true }),
  ).toHaveCount(0);
  await account(page, "Ana", "/historico");
  await expect(page.getByText(/Prêmio de aposta/)).toBeVisible();
});

test("cancelar prepara devolução e só credita após confirmação do pagamento", async ({
  page,
}) => {
  await account(page, "Ana", "/apostas");
  await bet(page, "Sim", "25");
  await account(page, "AdminTeste", "/admin/apostas/peruca");
  await page
    .getByRole("navigation", { name: "Seções da aposta" })
    .getByRole("button", { name: "Finalização", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Cancelar aposta e devolver Croins",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Preparar devoluções", exact: true })
    .click();
  const balance = () =>
    page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("croebet:demo-wallet:ana") ?? "{}")
          .balance,
    );
  expect(await balance()).toBe(1042);
  await page
    .getByRole("button", { name: "Devolver Croins", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar pagamento", exact: true })
    .click();
  await expect.poll(balance).toBe(1067);
  await expect(
    page.getByText("Aposta cancelada e valores devolvidos.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

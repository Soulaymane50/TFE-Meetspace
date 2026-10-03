import { expect, test } from '@playwright/test';
const base = process.env.FRONT_URL || 'http://localhost:5173';
test('confirmation du courriel consomme une seule fois le lien en StrictMode', async ({page}) => {
  test.skip(!['localhost','127.0.0.1'].includes(new URL(base).hostname), 'Recette locale uniquement');
  await page.addInitScript(() => localStorage.setItem('i18nextLng','fr'));
  let confirmations=0;
  await page.route('**/api/auth/email-change/confirm',async route=>{
    confirmations++;
    await route.fulfill(confirmations===1 ? {json:{email:'test@example.invalid'}} : {status:400,json:{message:'EMAIL_CHANGE_INVALID'}});
  });
  await page.goto(base+'/confirm-email-change?token=one-use-test');
  await expect(page.getByRole('heading',{name:'Adresse email mise à jour'})).toBeVisible();
  expect(confirmations).toBe(1);
  await expect(page.getByRole('link',{name:'Se reconnecter'})).toBeVisible();
});
test('confirmation du courriel présente un lien expiré sans double consommation', async({page})=>{
  test.skip(!['localhost','127.0.0.1'].includes(new URL(base).hostname), 'Recette locale uniquement');
  await page.addInitScript(()=>localStorage.setItem('i18nextLng','fr'));
  let confirmations=0;
  await page.route('**/api/auth/email-change/confirm',async route=>{
    confirmations++;
    await route.fulfill({status:400,json:{message:'EMAIL_CHANGE_EXPIRED'}});
  });
  await page.goto(base+'/confirm-email-change?token=expired-test');
  await expect(page.getByText('Ce lien a expiré. Relancez la demande depuis votre profil.')).toBeVisible();
  expect(confirmations).toBe(1);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { pushStatusSchema, pushSubscriptionSchema, pushSubscriptionsResultSchema, pushTestResultSchema, pushUnsubscribeSchema } from "../dist/index.js";

const subscription = { endpoint: "https://push.example/abc", keys: { p256dh: "key", auth: "secret" } };

test("assinatura de push exige HTTPS e chaves completas", () => {
  assert.deepEqual(pushSubscriptionSchema.parse(subscription), subscription);
  assert.equal(pushSubscriptionSchema.safeParse({ ...subscription, endpoint: "http://push.example/abc" }).success, false);
  assert.equal(pushSubscriptionSchema.safeParse({ ...subscription, keys: { p256dh: "key" } }).success, false);
  assert.equal(pushSubscriptionSchema.safeParse({ ...subscription, extra: true }).success, false);
  assert.deepEqual(pushUnsubscribeSchema.parse({ endpoint: subscription.endpoint }), { endpoint: subscription.endpoint });
  assert.equal(pushUnsubscribeSchema.safeParse({ endpoint: "http://push.example/abc" }).success, false);
});

test("respostas de push não aceitam campos ou contagens inválidas", () => {
  assert.deepEqual(pushStatusSchema.parse({ enabled: true, publicKey: "abc" }), { enabled: true, publicKey: "abc" });
  assert.equal(pushStatusSchema.safeParse({ enabled: true }).success, false);
  assert.equal(pushSubscriptionsResultSchema.safeParse({ subscriptions: -1 }).success, false);
  assert.equal(pushTestResultSchema.safeParse({ sent: 1.5 }).success, false);
});

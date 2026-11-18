import type { Wallet } from "@/features/wallet/wallet";
import type { Market } from "@/features/betting/markets";
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
export const overviewDay = (date: Date) => dayFormat.format(date);
export function buildOverview(accounts: {
    username: string;
    wallet: Wallet;
}[], markets: Market[], days: number, now: Date) {
    const today = overviewDay(now);
    const buckets = Array.from({ length: days }, (_, index) => {
        const date = new Date(`${today}T12:00:00Z`);
        date.setUTCDate(date.getUTCDate() - days + index + 1);
        return { day: date.toISOString().slice(0, 10), count: 0, total: 0 };
    });
    const byDay = new Map(buckets.map((bucket) => [bucket.day, bucket]));
    const inPeriod = (date: string) => Date.parse(date) <= now.getTime() && byDay.has(overviewDay(new Date(date)));
    const transactions = accounts.flatMap(({ username, wallet }) => wallet.transactions.map((entry) => ({ ...entry, username }))).filter((entry) => inPeriod(entry.createdAt)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const predictions = accounts.flatMap(({ username, wallet }) => wallet.predictions.filter((entry) => entry.id && entry.createdAt && inPeriod(entry.createdAt)).map((entry) => ({ ...entry, username })));
    for (const entry of predictions) {
        const bucket = byDay.get(overviewDay(new Date(entry.createdAt!)))!;
        bucket.count += 1;
        bucket.total += entry.stake;
    }
    const volume = predictions.reduce((sum, entry) => sum + entry.stake, 0);
    const active = new Set([...transactions, ...predictions].map((entry) => entry.username.toLowerCase())).size;
    const balance = accounts.reduce((sum, account) => sum + account.wallet.balance, 0);
    const bonus = transactions.filter((entry) => entry.description === "Bônus diário").reduce((sum, entry) => sum + entry.amount, 0);
    const adjustments = transactions.filter((entry) => ["Croins adicionados pelo admin", "Retirada de Croins pelo admin"].includes(entry.description)).reduce((sum, entry) => sum + entry.amount, 0);
    const pending = markets.flatMap((market) => {
        const expired = ["open", "paused"].includes(market.status) && !!market.endsAt && Date.parse(market.endsAt) <= now.getTime();
        const label = market.status === "resolved" ? "Aguardando pagamento" : market.status === "closed" ? "Aguardando resultado" : expired ? "Prazo encerrado" : null;
        return label ? [{ market, label, priority: market.status === "resolved" ? 0 : market.status === "closed" ? 1 : 2 }] : [];
    }).sort((a, b) => a.priority - b.priority);
    const topMarkets = markets.map((market) => {
        const entries = predictions.filter((entry) => entry.marketId === market.id);
        return { market, count: entries.length, total: entries.reduce((sum, entry) => sum + entry.stake, 0), participants: new Set(entries.map((entry) => entry.username.toLowerCase())).size };
    }).filter((entry) => entry.count > 0).sort((a, b) => b.total - a.total).slice(0, 5);
    return { buckets, transactions, active, volume, predictionCount: predictions.length, balance, bonus, adjustments, pending, topMarkets };
}

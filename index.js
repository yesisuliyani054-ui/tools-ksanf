
const TelegramBot = require('node-telegram-bot-api');
const {
    default: makeWASocket,
    useMultiFileAuthState
} = require('@whiskeysockets/baileys');
const fs = require("fs-extra");
const P = require("pino");

// ===== KEEP ALIVE (RAILWAY) =====
const PORT = process.env.PORT || 3000;
require('http')
  .createServer((req, res) => res.end("Bot Running"))
  .listen(PORT);

// ===== ENV =====
const token = process.env.8624512553:AAEvrYI1UIhjDJfLrYvTqjfQV7FPy1NtpE4;
const ADMIN_ID = process.env.8529520909;

const bot = new TelegramBot(token, { polling: true });

// ===== DATABASE =====
if (!fs.existsSync("./database.json")) {
    fs.writeJsonSync("./database.json", {
        users: {},
        senders: [],
        admin: [ADMIN_ID],
        payment: [],
        vipPrice: { mingguan: 10000, bulanan: 30000 }
    });
}

let db = fs.readJsonSync("./database.json");

// ===== SAVE DB =====
function saveDB() {
    fs.writeJsonSync("./database.json", db, { spaces: 2 });
}

// ===== USER =====
function getUser(id, username) {
    if (!db.users[id]) {
        db.users[id] = {
            username: username || "NoUsername",
            vip: false,
            limit: 10,
            sender: null
        };
        saveDB();
    }
    return db.users[id];
}

// ===== ADMIN =====
function isAdmin(id) {
    return db.admin.includes(String(id));
}

// ===== FORMAT =====
function formatRupiah(num) {
    return "Rp" + num.toLocaleString("id-ID");
}

// ===== AI SENDER =====
function getSender(userId) {
    const user = db.users[userId];

    if (!user.vip) return user.sender;

    if (db.senders.length > 0) {
        return db.senders[Math.floor(Math.random() * db.senders.length)];
    }

    return user.sender;
}

// ===== WHATSAPP =====
let sock;

async function startWA() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");

    sock = makeWASocket({
        auth: state,
        logger: P({ level: "silent" })
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        if (update.connection === "close") {
            console.log("Reconnect WA...");
            startWA();
        }
        if (update.connection === "open") {
            console.log("✅ WhatsApp Connected");
        }
    });
}
startWA();

// ===== PAIRING =====
async function startPairing(chatId, userId) {
    const { state, saveCreds } = await useMultiFileAuthState("./session");

    sock = makeWASocket({ auth: state });

    sock.ev.on("creds.update", saveCreds);

    bot.sendMessage(chatId, "📱 Kirim nomor (contoh: 628xxx)");

    bot.once("message", async (msg) => {
        const number = msg.text.replace(/[^0-9]/g, "");

        try {
            const code = await sock.requestPairingCode(number);

            bot.sendMessage(chatId, 🔗 PAIRING CODE:\n${code});

            let user = getUser(userId, msg.from.username);
            user.sender = number + "@s.whatsapp.net";
            saveDB();

        } catch {
            bot.sendMessage(chatId, "❌ Gagal pairing");
        }
    });
}

// ===== MENU =====
function mainMenu(chatId, user) {
    let keyboard = [
        [{ text: "📱 Tools", callback_data: "tools" }],
        [{ text: "💎 Buy VIP", callback_data: "vip" }],
        [{ text: "📊 Status", callback_data: "status" }]
    ];

    if (isAdmin(chatId)) {
        keyboard.push([{ text: "👑 ADMIN PANEL", callback_data: "admin" }]);
    }

    bot.sendMessage(chatId, 
✨ *BOT WHATSAPP TOOLS*

👤 @${user.username}
💎 Status: ${user.vip ? "VIP" : "FREE"}
⚡ Limit: ${user.limit}
, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
    });
}

// ===== START =====
bot.onText(/\/start/, (msg) => {
    const user = getUser(msg.from.id, msg.from.username);
    mainMenu(msg.chat.id, user);
});

// ===== BUTTON =====
bot.on("callback_query", (q) => {
    const chatId = q.message.chat.id;
    const user = getUser(q.from.id, q.from.username);

    if (q.data === "tools") {
        bot.sendMessage(chatId, 
📱 *TOOLS*

/connect
/cekbio 628xxx
/sendwa 628xxx|pesan
, { parse_mode: "Markdown" });
    }

if (q.data === "vip") {
        let pay = db.payment.map((p, i) =>
            ${i + 1}. ${p.nama}\n${p.nomor}
        ).join("\n\n");

        bot.sendMessage(chatId, 
💎 *VIP PACKAGE*

📅 Mingguan: ${formatRupiah(db.vipPrice.mingguan)}
📅 Bulanan: ${formatRupiah(db.vipPrice.bulanan)}

💳 *PAYMENT*
${pay || "Belum tersedia"}
, { parse_mode: "Markdown" });
    }

    if (q.data === "admin" && isAdmin(chatId)) {
        bot.sendMessage(chatId, 
👑 *ADMIN PANEL*

/addvip ID
/listuser

/addpay
/delpay 1
/listpay

/setvip minggu 15000
/setvip bulan 40000
, { parse_mode: "Markdown" });
    }
});

// ===== LIMIT =====
function checkLimit(user) {
    if (user.vip) return true;
    if (user.limit <= 0) return false;
    user.limit--;
    saveDB();
    return true;
}

// ===== COMMAND =====

// CONNECT WA
bot.onText(/\/connect/, (msg) => {
    startPairing(msg.chat.id, msg.from.id);
});

// CEK BIO + BUSINESS
bot.onText(/\/cekbio (.+)/, async (msg, match) => {
    const user = getUser(msg.from.id, msg.from.username);

    if (!checkLimit(user)) return bot.sendMessage(msg.chat.id, "❌ Limit habis");

    const number = match[1].replace(/[^0-9]/g, "");
    const jid = number + "@s.whatsapp.net";

    try {
        const status = await sock.fetchStatus(jid);

        let business = null;
        try {
            business = await sock.getBusinessProfile(jid);
        } catch {}

        let text = 
📱 Nomor: ${number}
📝 Bio: ${status?.status || "-"}

${business ? "🏢 Business Account" : "👤 Personal"}
;

        bot.sendMessage(msg.chat.id, text);

    } catch {
        bot.sendMessage(msg.chat.id, "❌ Gagal ambil data");
    }
});

// SEND WA
bot.onText(/\/sendwa (.+)/, async (msg, match) => {
    const user = getUser(msg.from.id, msg.from.username);

    if (!checkLimit(user)) return bot.sendMessage(msg.chat.id, "❌ Limit habis");

    const sender = getSender(msg.from.id);
    if (!sender) return bot.sendMessage(msg.chat.id, "❌ Connect WA dulu");

    const [number, text] = match[1].split("|");

    try {
        await sock.sendMessage(number + "@s.whatsapp.net", { text });
        bot.sendMessage(msg.chat.id, "✅ Pesan terkirim");
    } catch {
        bot.sendMessage(msg.chat.id, "❌ Gagal kirim");
    }
});

// ===== ADMIN =====

// ADD VIP
bot.onText(/\/addvip (.+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;

    if (!db.users[match[1]]) return bot.sendMessage(msg.chat.id, "User tidak ada");

    db.users[match[1]].vip = true;
    saveDB();

    bot.sendMessage(msg.chat.id, "✅ VIP aktif");
});

// LIST USER
bot.onText(/\/listuser/, (msg) => {
    if (!isAdmin(msg.from.id)) return;

    let text = "👥 USER LIST\n\n";

    for (let id in db.users) {
        text += ${id} | ${db.users[id].vip ? "VIP" : "FREE"}\n;
    }

    bot.sendMessage(msg.chat.id, text);
});

// ADD PAYMENT
bot.onText(/\/addpay/, (msg) => {
    if (!isAdmin(msg.from.id)) return;

    bot.sendMessage(msg.chat.id, "Format: Nama|Nomor");

    bot.once("message", (m) => {
        const [nama, nomor] = m.text.split("|");

        db.payment.push({ nama, nomor });
        saveDB();

        bot.sendMessage(msg.chat.id, "✅ Ditambahkan");
    });
});

// DELETE PAYMENT
bot.onText(/\/delpay (.+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;

    db.payment.splice(match[1] - 1, 1);
    saveDB();

    bot.sendMessage(msg.chat.id, "✅ Dihapus");
});

// LIST PAYMENT
bot.onText(/\/listpay/, (msg) => {
    if (!isAdmin(msg.from.id)) return;

    let text = "💳 PAYMENT\n\n";

    db.payment.forEach((p, i) => {
        text += ${i + 1}. ${p.nama}\n${p.nomor}\n\n;
    });

    bot.sendMessage(msg.chat.id, text);
});

// SET VIP PRICE
bot.onText(/\/setvip (.+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;

    const [type, price] = match[1].split(" ");

    if (type === "minggu") db.vipPrice.mingguan = parseInt(price);
    if (type === "bulan") db.vipPrice.bulanan = parseInt(price);

    saveDB();
    bot.sendMessage(msg.chat.id, "✅ Harga diupdate");
});
const http = require('http');

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.end("Bot Running");
}).listen(PORT);

console.log("Bot Running...");

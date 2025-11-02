/* =======================================
 * BOT WHATSAPP GAYA FURINA.JS (SATU FILE) - GRN DIGITAL STORE
 * Database: SQLite
 * API: Sama persis dengan Furina.js
 * FITUR: VPN Dinamis (Harga Dinamis), Ledger, Reseller Manual, Whitelist Grup, Kontrol Perintah, Blacklist,
 * Statistik, Voucher Saldo, Mode Maintenance, Cek Penjualan, Referral Grup, Game Grup (Tebak Kata, Trivia, Suit)
 * UPDATE: Menggunakan baileys_helper
 * FIX: Crash Topup Foto, Menu Owner Gabungan, Teks Menu Kustom, Output VPN Copyable Link
 * VERSI LENGKAP - v6 (Perubahan Interaktif & Output API)
 * =======================================
 */

// --- 1. IMPORT DEPENDENSI ---
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    proto, // Diperlukan untuk donasi carousel & referral
    generateWAMessageFromContent, // Diperlukan untuk donasi carousel
    prepareWAMessageMedia, // Diperlukan untuk donasi carousel
    getAggregateVotesInPollMessage // Diperlukan jika ingin fitur polling
} = require('@whiskeysockets/baileys');
// Helper baru untuk tombol interaktif
const { sendInteractiveMessage, sendButtons } = require('baileys_helper');
const { pinterest } = require('@bochilteam/scraper'); // Untuk .pinterest
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const moment = require('moment-timezone');
const sqlite3 = require('sqlite3').verbose();
const util = require('util');

// --- 2. PENGATURAN GLOBAL & DATABASE ---

// Variabel Global
const OWNER_NUMBERS = ["6285150588080", "6285117557905"]; // Nomor Owner Diperbarui
const QRIS_IMAGE_PATH = './qris.png';
// Variabel Branding & Donasi (Diperbarui)
const ownername = 'GRN DIGITAL STORE';
const botName = 'GRN STORE Bot';
const global_andana = '087786388052';
const global_nodana = '087786388052';
const global_angopay = '085117557905';
const global_nogopay = '085117557905';
const saweriaLink = 'https://saweria.co/'; // Ganti jika perlu
const referralBonus = 10; // Bonus saldo referral (contoh: Rp 1000)

// API DARI FURINA.JS (HANYA UNTUK CEK KUOTA & OTP)
const CEKKUOTA_SECRET = "zhYqHrObvu62ZJOJeWADvp2a";
const CEKKUOTA_URL = 'https://sidompul.violetvpn.biz.id/api/sidompul';
global.myxlApi = "https://api.myxl.example.com"; // GANTI DENGAN URL API MYXL ANDA
global.myxlApiKey = "API_KEY_ANDA"; // GANTI DENGAN API KEY MYXL ANDA

// Sesi Global
global.pendingTopups = {};
global.resellerPurchaseSessions = {};
global.otpSessions = {};
global.vpnCreationSessions = {};
global.transactionSessions = {};
global.selectionSessions = {};
global.contactOwnerSessions = {};
global.unregSessions = {};
global.renewSessions = {}; // Sesi untuk perpanjang VPN
global.productCache = null;
// Global untuk Kontrol Akses & Status Bot (BARU)
global.allowedGroups = new Set();
global.commandPerms = {}; // { commandName: scope ('all', 'private', 'group', 'owner', 'off') }
global.blacklistedUsers = new Set(); // Menyimpan JID user/grup yang diblacklist
global.isMaintenanceMode = false; // Status mode maintenance
global.activeReferralCodes = {}; // Menyimpan kode referral aktif { referralCode: { referrerJid: '...', groupId: '...' } } (BARU)
global.gameSessions = {}; // Menyimpan sesi game aktif { jid: { type: 'tebakkata/trivia/suit', data: {...} } } (BARU)

// Data Game (Contoh)
const tebakKataData = [
    { kata: "apel", clue: "Buah berwarna merah atau hijau" },
    { kata: "kucing", clue: "Hewan peliharaan yang suka mengeong" },
    { kata: "komputer", clue: "Mesin elektronik untuk mengolah data" },
    // Tambahkan lebih banyak
];
const triviaData = [
    { q: "Ibukota Indonesia?", a: "jakarta", o: ["jakarta", "bandung", "surabaya"] },
    { q: "Siapa presiden pertama Indonesia?", a: "soekarno" },
    { q: "Berapa jumlah provinsi di Indonesia saat ini (Oktober 2025)?", a: "38" },
    // Tambahkan lebih banyak
];


// Pengaturan Database SQLite
const DB_FILE = path.join(__dirname, 'bot_database.db');
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) console.error('Gagal membuka database', err.message);
    else {
        console.log('Terhubung ke database SQLite.');
        initDB();
    }
});

// Fungsi helper query
const dbRun = (query, params = []) => new Promise((resolve, reject) => db.run(query, params, function(err) { if (err) reject(err); else resolve(this); }));
const dbGet = (query, params = []) => new Promise((resolve, reject) => db.get(query, params, (err, row) => { if (err) reject(err); else resolve(row); }));
const dbAll = (query, params = []) => new Promise((resolve, reject) => db.all(query, params, (err, rows) => { if (err) reject(err); else resolve(rows); }));

// Inisialisasi Tabel Database (Update: Tambah Tabel Referrals)
async function initDB() {
    await dbRun(`CREATE TABLE IF NOT EXISTS users (jid TEXT PRIMARY KEY, name TEXT, age INTEGER DEFAULT 20, balance INTEGER DEFAULT 0, premium BOOLEAN DEFAULT false, premiumTime INTEGER DEFAULT 0, reseller INTEGER DEFAULT 0, trialVpnCount INTEGER DEFAULT 0, registered BOOLEAN DEFAULT true, regTime INTEGER DEFAULT 0, verified_number TEXT, id_token TEXT, access_token TEXT, refresh_token TEXT, verification_timestamp INTEGER)`);
    await dbRun(`
        CREATE TABLE IF NOT EXISTS vpn_servers (
            server_name TEXT PRIMARY KEY, api_url TEXT NOT NULL, api_token TEXT NOT NULL,
            price_ssh_regular INTEGER DEFAULT 8000, price_ssh_premium INTEGER DEFAULT 5000, price_ssh_stb INTEGER DEFAULT 10000,
            price_vmess_regular INTEGER DEFAULT 8000, price_vmess_premium INTEGER DEFAULT 5000, price_vmess_stb INTEGER DEFAULT 10000,
            price_vless_regular INTEGER DEFAULT 8000, price_vless_premium INTEGER DEFAULT 5000, price_vless_stb INTEGER DEFAULT 10000,
            price_trojan_regular INTEGER DEFAULT 8000, price_trojan_premium INTEGER DEFAULT 5000, price_trojan_stb INTEGER DEFAULT 10000
        )
    `);
    // Migrasi kolom harga
    try {
        const columnsToAdd = ['price_ssh_regular INTEGER DEFAULT 8000', 'price_ssh_premium INTEGER DEFAULT 5000', 'price_ssh_stb INTEGER DEFAULT 10000','price_vmess_regular INTEGER DEFAULT 8000', 'price_vmess_premium INTEGER DEFAULT 5000', 'price_vmess_stb INTEGER DEFAULT 10000','price_vless_regular INTEGER DEFAULT 8000', 'price_vless_premium INTEGER DEFAULT 5000', 'price_vless_stb INTEGER DEFAULT 10000','price_trojan_regular INTEGER DEFAULT 8000', 'price_trojan_premium INTEGER DEFAULT 5000', 'price_trojan_stb INTEGER DEFAULT 10000'];
        for (const col of columnsToAdd) await dbRun(`ALTER TABLE vpn_servers ADD COLUMN ${col}`).catch(() => {});
        console.log("Migrasi kolom harga vpn_servers check complete.");
    } catch (e) { /* Abaikan error */ }

    await dbRun(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT NOT NULL, type TEXT NOT NULL, product_name TEXT, amount INTEGER NOT NULL, timestamp INTEGER NOT NULL)`);
    await dbRun(`CREATE TABLE IF NOT EXISTS group_whitelist (jid TEXT PRIMARY KEY)`);
    await dbRun(`CREATE TABLE IF NOT EXISTS command_permissions (command TEXT PRIMARY KEY, scope TEXT NOT NULL DEFAULT 'all')`);
    await dbRun(`CREATE TABLE IF NOT EXISTS blacklist (jid TEXT PRIMARY KEY, reason TEXT)`);
    await dbRun(`CREATE TABLE IF NOT EXISTS vouchers (code TEXT PRIMARY KEY, amount INTEGER NOT NULL, used_by TEXT, used_at INTEGER)`);
    // --- TABEL BARU: Referrals ---
    await dbRun(`CREATE TABLE IF NOT EXISTS referrals (referred_jid TEXT PRIMARY KEY, referrer_jid TEXT NOT NULL, group_jid TEXT NOT NULL, timestamp INTEGER NOT NULL)`);
    // ----------------------------

    console.log('Semua tabel SQLite siap.');

    // Tambah server default jika belum ada
    const servers = await dbAll('SELECT * FROM vpn_servers');
    if (servers.length === 0) {
        await dbRun('INSERT INTO vpn_servers (server_name, api_url, api_token) VALUES (?, ?, ?)', ['sg', 'http://146.19.196.212/vps', 'potatoklHl1IZu5GUKF1M2YW7qKSkZUMicQ8']);
        console.log('Server VPN default [sg] ditambahkan.');
    }

    // Muat data kontrol akses
    await loadControlData();
}

// Fungsi Pendaftaran Otomatis
async function initUser(jid, pushName) {
    let user = await dbGet('SELECT * FROM users WHERE jid = ?', [jid]);
    if (!user) {
        const regTime = Date.now();
        await dbRun('INSERT OR IGNORE INTO users (jid, name, regTime) VALUES (?, ?, ?)', [jid, pushName, regTime]);
        console.log(`Pengguna baru terdaftar (SQL): ${pushName} (${jid})`);
        user = await dbGet('SELECT * FROM users WHERE jid = ?', [jid]);
    }
    user = {
        age: 20, balance: 0, premium: false, premiumTime: 0, reseller: 0,
        trialVpnCount: 0, registered: true, regTime: user?.regTime || Date.now(),
        verified_number: null, id_token: null, access_token: null,
        refresh_token: null, verification_timestamp: null,
        ...user
    };
    return user;
}

// --- Fungsi Baru: Muat Whitelist, Permissions & Blacklist ---
async function loadControlData() {
    global.allowedGroups = new Set((await dbAll('SELECT jid FROM group_whitelist')).map(g => g.jid));
    console.log(`Whitelist Grup dimuat: ${global.allowedGroups.size} grup.`);
    global.commandPerms = {};
    (await dbAll('SELECT command, scope FROM command_permissions')).forEach(p => global.commandPerms[p.command] = p.scope);
    console.log(`Permissions Command dimuat: ${Object.keys(global.commandPerms).length} aturan.`);
    global.blacklistedUsers = new Set((await dbAll('SELECT jid FROM blacklist')).map(b => b.jid));
    console.log(`Blacklist dimuat: ${global.blacklistedUsers.size} JID.`);
}

// Fungsi Helper Database (Objek) - Update: Fungsi referral
const dbHelper = {
    getUser: (jid) => dbGet('SELECT * FROM users WHERE jid = ?', [jid]),
    getAllUsers: () => dbAll('SELECT jid FROM users'),
    updateBalance: (jid, amount) => dbRun('UPDATE users SET balance = balance + ? WHERE jid = ?', [amount, jid]),
    setPremium: async (jid, durationInDays) => {
        const premiumTime = Date.now() + (durationInDays * 24 * 60 * 60 * 1000);
        await dbRun('UPDATE users SET premium = ?, premiumTime = ?, reseller = 1 WHERE jid = ?', [true, premiumTime, jid]); return true;
    },
    delPremium: (jid) => dbRun('UPDATE users SET premium = ?, premiumTime = 0, reseller = 0 WHERE jid = ?', [false, jid]),
    updateTokens: (jid, data) => dbRun(`UPDATE users SET verified_number = ?, id_token = ?, access_token = ?, refresh_token = ?, verification_timestamp = ? WHERE jid = ?`, [data.phone, data.id_token, data.access_token, data.refresh_token, data.timestamp, jid]),
    clearTokens: (jid) => dbRun(`UPDATE users SET verified_number = NULL, id_token = NULL, access_token = NULL, refresh_token = NULL, verification_timestamp = NULL WHERE jid = ?`, [jid]),
    incrementTrialCount: (jid) => dbRun('UPDATE users SET trialVpnCount = trialVpnCount + 1 WHERE jid = ?', [jid]),
    addVpnServer: (name, url, token) => dbRun('INSERT OR REPLACE INTO vpn_servers (server_name, api_url, api_token) VALUES (?, ?, ?)', [name.toLowerCase(), url, token]),
    delVpnServer: (name) => dbRun('DELETE FROM vpn_servers WHERE server_name = ?', [name.toLowerCase()]),
    getVpnServer: (name) => dbGet('SELECT * FROM vpn_servers WHERE server_name = ?', [name.toLowerCase()]),
    getAllVpnServers: () => dbAll('SELECT * FROM vpn_servers'),
    setVpnPrice: async (serverName, vpnType, priceRegular, pricePremium, priceStb) => {
        const typeLower = vpnType.toLowerCase(); if (!['ssh', 'vmess', 'vless', 'trojan'].includes(typeLower)) throw new Error(`Tipe VPN tidak valid: ${vpnType}`);
        const colReg = `price_${typeLower}_regular`; const colPrem = `price_${typeLower}_premium`; const colStb = `price_${typeLower}_stb`;
        return await dbRun(`UPDATE vpn_servers SET ${colReg} = ?, ${colPrem} = ?, ${colStb} = ? WHERE server_name = ?`, [priceRegular, pricePremium, priceStb, serverName.toLowerCase()]);
    },
    getVpnPrice: async (serverName, vpnType, isStb, isPremium) => {
        const server = await dbHelper.getVpnServer(serverName); if (!server) return null;
        const typeLower = vpnType.toLowerCase(); let priceColumn;
        if (isStb) priceColumn = `price_${typeLower}_stb`; else if (isPremium) priceColumn = `price_${typeLower}_premium`; else priceColumn = `price_${typeLower}_regular`;
        return server[priceColumn] === null ? 0 : server[priceColumn];
    },
    logTransaction: (jid, type, product_name, amount) => dbRun('INSERT INTO transactions (jid, type, product_name, amount, timestamp) VALUES (?, ?, ?, ?, ?)', [jid, type, product_name, amount, Date.now()]),
    getTransactions: (jid) => dbAll('SELECT * FROM transactions WHERE jid = ? AND timestamp >= ? ORDER BY timestamp DESC', [jid, Date.now() - (60 * 24 * 60 * 60 * 1000)]),
    getLedger: (daysAgo) => {
        const now = new Date(); now.setHours(0, 0, 0, 0); const startTime = now.getTime() - (daysAgo * 24 * 60 * 60 * 1000);
        return dbAll('SELECT type, SUM(amount) as total_amount, COUNT(id) as total_count FROM transactions WHERE timestamp >= ? GROUP BY type', [startTime]);
    },
    clearLedger: () => dbRun('DELETE FROM transactions'),
    deleteOldTransactions: (days) => dbRun('DELETE FROM transactions WHERE timestamp < ?', [Date.now() - (days * 24 * 60 * 60 * 1000)]),
    addGroupToWhitelist: async (jid) => { const r = await dbRun('INSERT OR IGNORE INTO group_whitelist (jid) VALUES (?)', [jid]); if (r.changes > 0) global.allowedGroups.add(jid); return r.changes > 0; },
    delGroupFromWhitelist: async (jid) => { const r = await dbRun('DELETE FROM group_whitelist WHERE jid = ?', [jid]); if (r.changes > 0) global.allowedGroups.delete(jid); return r.changes > 0; },
    getAllowedGroups: () => dbAll('SELECT jid FROM group_whitelist'),
    setCommandPermission: async (command, scope) => { const v = ['all', 'private', 'group', 'owner', 'off']; if (!v.includes(scope)) throw new Error(`Scope tidak valid: ${scope}`); await dbRun('INSERT OR REPLACE INTO command_permissions (command, scope) VALUES (?, ?)', [command, scope]); global.commandPerms[command] = scope; return true; },
    getCommandPermission: (command) => {
         // Owner commands implicit (Termasuk game admin)
         const o = ['addvpnserver', 'delvpnserver', 'listvpnserver', 'setharga', 'setvpnprice', 'addsaldo', 'delsaldo', 'acctopup', 'tolaktopup', 'addprem', 'delprem', 'laporan', 'ledger', 'clearledger', 'confirmclearledger', 'addgroup', 'delgroup', 'listgroup', 'setcmdperm', 'blacklist', 'unblacklist', 'listblacklist', 'createvoucher', 'maintenance', 'botstats', 'stoptrivia', 'stoptebak'];
         if (o.includes(command)) return 'owner';
         // Game commands default group
         const g = ['tebakkata', 'trivia', 'suit', 'nyerah', 'skipref', 'joinref']; // Tambah ref
         if (g.includes(command) && !global.commandPerms[command]) return 'group'; // Default game ke group
         return global.commandPerms[command] || 'all'; // Default lainnya all
    },
    getAllCommandPermissions: () => dbAll('SELECT command, scope FROM command_permissions'),
    addToBlacklist: async (jid, reason) => { const r = await dbRun('INSERT OR IGNORE INTO blacklist (jid, reason) VALUES (?, ?)', [jid, reason || 'N/A']); if (r.changes > 0) global.blacklistedUsers.add(jid); return r.changes > 0; },
    removeFromBlacklist: async (jid) => { const r = await dbRun('DELETE FROM blacklist WHERE jid = ?', [jid]); if (r.changes > 0) global.blacklistedUsers.delete(jid); return r.changes > 0; },
    isBlacklisted: (jid) => global.blacklistedUsers.has(jid),
    getBlacklist: () => dbAll('SELECT jid, reason FROM blacklist'),
    createVoucher: (code, amount) => dbRun('INSERT INTO vouchers (code, amount) VALUES (?, ?)', [code, amount]),
    getVoucher: (code) => dbGet('SELECT * FROM vouchers WHERE code = ?', [code]),
    useVoucher: (code, jid) => dbRun('UPDATE vouchers SET used_by = ?, used_at = ? WHERE code = ?', [jid, Date.now(), code]),
    deleteVoucher: (code) => dbRun('DELETE FROM vouchers WHERE code = ?', [code]),
    getBotStats: async () => {
         const userCount = await dbGet('SELECT COUNT(jid) as count FROM users');
         const premiumCount = await dbGet('SELECT COUNT(jid) as count FROM users WHERE premium = 1 OR premiumTime >= ?', [Date.now()]);
         const todayStart = moment().tz('Asia/Jakarta').startOf('day').valueOf();
         const salesToday = await dbGet('SELECT SUM(amount) as total FROM transactions WHERE type IN (?, ?) AND timestamp >= ?', ['VPN_BUY', 'RESELLER_BUY', 'VPN_RENEW', todayStart]);
         const topupToday = await dbGet('SELECT SUM(amount) as total FROM transactions WHERE type = ? AND timestamp >= ?', ['TOPUP', todayStart]);
         return { totalUsers: userCount?.count || 0, premiumUsers: premiumCount?.count || 0, salesToday: salesToday?.total || 0, topupToday: topupToday?.total || 0 };
    },
    getResellerSales: (jid, daysAgo) => {
         const now = new Date(); now.setHours(0, 0, 0, 0); const startTime = now.getTime() - (daysAgo * 24 * 60 * 60 * 1000);
         return dbAll('SELECT product_name, amount, timestamp FROM transactions WHERE jid = ? AND type IN (?, ?) AND timestamp >= ? ORDER BY timestamp DESC', [jid, 'VPN_BUY', 'VPN_RENEW', startTime]);
    },
    // --- Fungsi DB Referral (BARU) ---
    addReferral: (referrerJid, referredJid, groupJid) => dbRun('INSERT OR IGNORE INTO referrals (referred_jid, referrer_jid, group_jid, timestamp) VALUES (?, ?, ?, ?)', [referredJid, referrerJid, groupJid, Date.now()]),
    getReferralsByUser: (referrerJid) => dbAll('SELECT referred_jid, group_jid, timestamp FROM referrals WHERE referrer_jid = ? ORDER BY timestamp DESC', [referrerJid]),
    getReferralByReferred: (referredJid) => dbGet('SELECT referrer_jid FROM referrals WHERE referred_jid = ?', [referredJid])
    // ------------------------------------
};

// --- 3. FUNGSI HELPER LAINNYA ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const isUrl = (url) => url.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/, 'gi'));
const isMaintenance = () => global.isMaintenanceMode;
async function ensureValidTokens(senderId) {
     const user = await dbHelper.getUser(senderId); if (!user || !user.refresh_token) return false; const fiveMinutes = 300 * 1000;
     if (Date.now() - user.verification_timestamp > fiveMinutes) {
         console.log(`Refreshing token for ${senderId}...`);
         try {
             const response = await axios.post(`${global.myxlApi}/auth/token/refresh`, { refresh_token: user.refresh_token }, { headers: { 'X-API-Key': global.myxlApiKey, 'Content-Type': 'application/json' } });
             if (response.data?.id_token) { await dbHelper.updateTokens(senderId, { phone: user.verified_number, ...response.data, timestamp: Date.now() }); console.log(`Token ${senderId} refreshed.`); return true; }
             else { await dbHelper.clearTokens(senderId); return false; }
         } catch (error) { console.error("Token refresh failed:", error.response?.data || error.message); await dbHelper.clearTokens(senderId); return false; }
     }
     return true;
}

// --- 4. FUNGSI KONEKSI UTAMA ---
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({ version, logger: pino({ level: 'silent' }), printQRInTerminal: true, auth: state });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) { console.log('Connection closed, reconnecting...'); connectToWhatsApp(); }
            else { console.log('Connection closed permanently.'); }
        } else if (connection === 'open') {
            console.log('WhatsApp connection opened!');
            await loadControlData();
            console.log('Cleaning old transactions (>60 days)...');
            try {
                const result = await dbHelper.deleteOldTransactions(60);
                console.log(`DB cleanup: ${result.changes > 0 ? result.changes + ' old transactions deleted.' : 'No old transactions found.'}`);
            } catch (e) { console.error('DB cleanup failed:', e); }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // --- 5. MESSAGE HANDLER UTAMA ---
    sock.ev.on('messages.upsert', async (m) => {

        let pushName = "[unknown]"; let sender = "[unknown]"; let body = "";
        let msg = null; let jid = null;

        try {
            msg = m.messages[0];
            const chatUpdate = m;
            if (!msg.message || msg.key.fromMe) return;

            jid = msg.key.remoteJid;
            pushName = msg.pushName || "Tanpa Nama";
            sender = msg.key.participant || msg.key.remoteJid;
            const isGroup = jid.endsWith('@g.us');
            const isOwner = OWNER_NUMBERS.includes(sender.split('@')[0]);

            if (isMaintenance() && !isOwner) return;
            if ((dbHelper.isBlacklisted(sender) || (isGroup && dbHelper.isBlacklisted(jid))) && !isOwner) return;
            if (isGroup && !global.allowedGroups.has(jid) && !isOwner) return;

            // --- Pendaftaran Otomatis & Cek Referral ---
            const isNewUser = !(await dbHelper.getUser(sender));
            const user = await initUser(sender, pushName);
            let isPrem = user.premium || (user.premiumTime > 0 && Date.now() < user.premiumTime) || isOwner;
            if (user.premium && user.premiumTime > 0 && Date.now() >= user.premiumTime) { await dbHelper.delPremium(sender); isPrem = isOwner; }

            // --- Logika Bonus Referral ---
            if (isNewUser && isGroup && global.activeReferralCodes) {
                const referralEntry = Object.entries(global.activeReferralCodes).find(([code, data]) => data.groupId === jid);
                if (referralEntry) {
                    const [referralCode, referralData] = referralEntry;
                    const referrerJid = referralData.referrerJid;
                    if (!(await dbHelper.getReferralByReferred(sender))) {
                         await dbHelper.addReferral(referrerJid, sender, jid);
                         await dbHelper.updateBalance(referrerJid, referralBonus);
                         await sock.sendMessage(referrerJid, { text: `🎉 @${sender.split('@')[0]} join via ref Anda! Bonus Rp ${referralBonus.toLocaleString('id-ID')} ditambahkan!`, mentions: [sender] });
                         console.log(`Referral: ${referrerJid} -> ${sender} di ${jid}`);
                    }
                }
            }
            // -----------------------------

            let interactiveResponseId = null;
            if (msg.message?.interactiveResponseMessage) {
                const paramsJson = msg.message.interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson;
                if (paramsJson) { try { const p = JSON.parse(paramsJson); interactiveResponseId = p.id; } catch (e) { console.error("Parse paramsJson failed:", e); } }
            }
            body = msg.message?.conversation || msg.message?.extendedTextMessage?.text ||
                   interactiveResponseId || msg.message?.buttonsResponseMessage?.selectedButtonId ||
                   msg.message?.templateButtonReplyMessage?.selectedId || "";

            // --- 6. HANDLER NON-COMMAND (SESI & GAME) ---

            // Handler Sesi OTP
            if (otpSessions[sender] && !body.startsWith('.')) {
                let userSession = otpSessions[sender];
                if (userSession.stage === 'waiting_for_phone') {
                    let phoneNumber = body.trim().replace(/[^0-9]/g, "");
                    if (/^(08|628)[1-9][0-9]{7,11}$/.test(phoneNumber)) {
                        let formattedNumber = phoneNumber.startsWith('08') ? '62' + phoneNumber.slice(1) : phoneNumber;
                        await sock.sendMessage(jid, { text: `Mengirim OTP ke ${formattedNumber}...` });
                        try {
                            await axios.post(`${global.myxlApi}/auth/otp/request`, { contact: formattedNumber }, { headers: { 'X-API-Key': global.myxlApiKey, 'Content-Type': 'application/json' } });
                            userSession.stage = 'waiting_for_otp'; userSession.phone = formattedNumber;
                            await sock.sendMessage(jid, { text: `✅ OTP Terkirim. Balas dengan kode OTP.\nKetik .batalkan untuk batal.` });
                        } catch (error) { await sock.sendMessage(jid, { text: "Gagal meminta OTP." }); delete otpSessions[sender]; }
                    } else { await sock.sendMessage(jid, { text: `Format nomor HP tidak valid.\nKetik .batalkan untuk batal.` }); }
                } else if (userSession.stage === 'waiting_for_otp') {
                    const otpCode = body.trim(); if (!/^\d{4,6}$/.test(otpCode)) return sock.sendMessage(jid, { text: "Format OTP tidak valid.\nKetik .batalkan untuk batal." });
                    await sock.sendMessage(jid, { text: "Memverifikasi OTP..." });
                    try {
                        const verifyResponse = await axios.post(`${global.myxlApi}/auth/otp/submit`, { contact: userSession.phone, code: otpCode }, { headers: { 'X-API-Key': global.myxlApiKey, 'Content-Type': 'application/json' } });
                        if (verifyResponse.data && verifyResponse.data.id_token) {
                            let displayPhone = userSession.phone.startsWith('62') ? '0' + userSession.phone.slice(2) : userSession.phone;
                            await dbHelper.updateTokens(sender, { phone: displayPhone, id_token: verifyResponse.data.id_token, access_token: verifyResponse.data.access_token, refresh_token: verifyResponse.data.refresh_token, timestamp: Date.now() });
                            await sock.sendMessage(jid, { text: `✅ Verifikasi *(${displayPhone})* berhasil.` });
                        } else { await sock.sendMessage(jid, { text: `❌ OTP salah/kedaluwarsa.` }); }
                    } catch (error) { await sock.sendMessage(jid, { text: "❌ Verifikasi gagal." });
                    } finally { delete otpSessions[sender]; }
                }
                return;
            }

            // Handler Sesi Lapor Owner
            if (isOwner && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
                const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || "";
                if (quotedText && (quotedText.includes('*PESAN BARU DARI USER*') || quotedText.includes('*PESAN LANJUTAN DARI USER*'))) {
                    const userNumberMatch = quotedText.match(/\((\d+)\)/);
                    if (userNumberMatch && userNumberMatch[1]) {
                        const targetNumber = userNumberMatch[1]; const targetId = `${targetNumber}@s.whatsapp.net`;
                        if (body.trim().toLowerCase() === '.selesai') {
                            if (contactOwnerSessions[targetId]) { delete contactOwnerSessions[targetId]; await sock.sendMessage(targetId, { text: "Sesi chat berakhir." }); return sock.sendMessage(jid, { text: `Sesi ${targetNumber} diakhiri.` }); }
                        } else { await sock.sendMessage(targetId, { text: `*BALASAN OWNER*\n\nPesan: ${body}` }); return sock.sendMessage(jid, { react: { text: `✅`, key: msg.key } }); }
                    }
                }
            }
            if (contactOwnerSessions[sender] && !body.startsWith('.')) {
                const forwardMessage = `*PESAN LANJUTAN DARI USER*\n\n*Dari:* ${pushName} (${sender.split('@')[0]})\n*Pesan:* ${body}\n\n_(Reply .selesai)_`;
                for (const owner of OWNER_NUMBERS) await sock.sendMessage(owner + '@s.whatsapp.net', { text: forwardMessage });
                await sock.sendMessage(jid, { react: { text: `✅`, key: msg.key } }); return;
            }

            // Handler Bukti Topup (FIXED)
            if (msg.message?.imageMessage && !body.startsWith('.')) {
                const userPendingTx = Object.entries(global.pendingTopups).find(([txId, tx]) => tx.userId === sender && (tx.status === 'pending' || tx.status === 'menunggu_acc'));
                if (userPendingTx) {
                    const [transactionId, details] = userPendingTx;
                    if (details.status === 'menunggu_acc') return await sock.sendMessage(jid, { text: `Bukti sudah dikirim. Tunggu konfirmasi.` });
                    const media = await sock.downloadMediaMessage(msg);
                    const captionFromUser = msg.message.imageMessage.caption || "Tidak ada caption.";
                    const forwardMessage = `*KONFIRMASI TOPUP (BUKTI)*\n\nDari: ${details.pushName} (${details.userId.split('@')[0]})\nJumlah: Rp ${details.amount.toLocaleString('id-ID')}\nID: \`${transactionId}\`\nCaption: ${captionFromUser}\n\n.acctopup ${transactionId}\n.tolaktopup ${transactionId} [alasan]`;
                    for (const owner of OWNER_NUMBERS) await sock.sendMessage(owner + '@s.whatsapp.net', { image: media, caption: forwardMessage });
                    await sock.sendMessage(jid, { text: `✅ Bukti transfer diteruskan.` });
                    global.pendingTopups[transactionId].status = 'menunggu_acc';
                }
                return;
            }

            // Handler Sesi VPN (Harga Dinamis & Output Detail Sesuai JSON)
            if (vpnCreationSessions[sender] && !body.startsWith('.')) {
                let session = vpnCreationSessions[sender]; let userMessage = body.trim();
                if (session.step === 'awaiting_username') {
                    let normalizedUsername = userMessage.toLowerCase().replace(/[^a-z0-9]/g, ''); if (normalizedUsername.length < 6) return sock.sendMessage(jid, { text: 'Username min 6 char.\nKetik .batalkan untuk batal.' });
                    session.username = normalizedUsername; session.step = 'awaiting_password'; 
                    return sock.sendMessage(jid, { text: `✅ Username: *${normalizedUsername}*\n\nBalas *password* (min 6).\nKetik .batalkan untuk batal.` });
                }
                if (session.step === 'awaiting_password') {
                    let normalizedPassword = userMessage.toLowerCase().replace(/[^a-z0-9]/g, ''); if (normalizedPassword.length < 6) return sock.sendMessage(jid, { text: 'Password min 6 char.\nKetik .batalkan untuk batal.' });
                    session.password = normalizedPassword;
                    const { vpnType, username, password, isStb, serverName } = session; const days = 30;
                    let totalPrice = await dbHelper.getVpnPrice(serverName, vpnType, isStb, isPrem);
                    if (totalPrice === null) { delete vpnCreationSessions[sender]; return sock.sendMessage(jid, { text: `Server [${serverName}] error.`}); }
                    if (totalPrice === 0) { delete vpnCreationSessions[sender]; return sock.sendMessage(jid, { text: `Harga belum diatur.`}); }
                    if (user.balance < totalPrice) { delete vpnCreationSessions[sender]; return sock.sendMessage(jid, { text: `Saldo kurang! Butuh Rp ${totalPrice.toLocaleString('id-ID')}` }); }
                    await sock.sendMessage(jid, { text: `✅ Data OK. Biaya *Rp ${totalPrice.toLocaleString('id-ID')}* dipotong. Memproses...` });
                    await dbHelper.updateBalance(sender, -totalPrice);
                    const updatedUser = await dbHelper.getUser(sender);
                    
                    // --- AWAL BLOK PENGGANTI ---
                    try {
                        const serverConfig = await dbHelper.getVpnServer(serverName);
                        const VPN_API_BASE_URL = serverConfig.api_url;
                        const VPN_API_TOKEN = serverConfig.api_token;
                        let endpoint = '';
                        let payload = {};

                        // Tipe endpoint disesuaikan dengan API baru
                        if (vpnType === 'ssh') { 
                            endpoint = '/sshvpn'; 
                            payload = isStb ? { expired: days, limitip: 7, password: password, username: username } : { expired: days, limitip: 3, password: password, username: username }; 
                        } else { 
                            endpoint = `/${vpnType}all`; // Endpoint untuk vmess, vless, trojan
                            payload = isStb ? { expired: days, kuota: 900, limitip: 7, username: username, uuidv2: password } : { expired: days, kuota: 400, limitip: 3, username: username, uuidv2: password }; 
                        }
                        
                        const response = await axios.post(VPN_API_BASE_URL + endpoint, payload, { 
                            headers: { 'accept': 'application/json', 'Authorization': VPN_API_TOKEN, 'Content-Type': 'application/json' } 
                        });
                        
                        const productName = `VPN ${isStb ? 'STB ' : ''}${vpnType.toUpperCase()} [${serverName.toUpperCase()}]`; 
                        await dbHelper.logTransaction(sender, 'VPN_BUY', productName, totalPrice);
                        
                        const vpnData = response.data.data;

                        // --- Pembuatan Teks Output Dinamis ---
                        let resultText = `✅ *VPN [${serverName.toUpperCase()}] ${isStb ? 'STB ' : ''}${vpnType.toUpperCase()} OK!*\n\n`;
                        resultText += `\`\`\`Informasi Akun\`\`\`\n`;
                        resultText += `• Server: ${vpnData.hostname}\n`;
                        resultText += `• User: ${vpnData.username}\n`;
                        resultText += `• Pass: ${vpnData.password || password}\n`; // Fallback ke password jika API tidak return
                        if (vpnData.uuid) resultText += `• UUID: ${vpnData.uuid}\n`;
                        resultText += `• Exp: ${vpnData.exp || vpnData.expired}\n\n`;

                        resultText += `\`\`\`Informasi Server\`\`\`\n`;
                        resultText += `• Lokasi: ${vpnData.CITY}, ${vpnData.ISP}\n`;

                        // Port (Dynamic)
                        if (vpnData.port) {
                            resultText += `\n\`\`\`Informasi Port\`\`\`\n`;
                            if(vpnData.port.tls) resultText += `• SSL/TLS: ${vpnData.port.tls}\n`;
                            if(vpnData.port.none) resultText += `• Non-TLS: ${vpnData.port.none}\n`;
                            if(vpnData.port.any) resultText += `• Any: ${vpnData.port.any}\n`;
                            
                            // Port Khusus SSH
                            if(vpnType === 'ssh') {
                                if(vpnData.port.ovpntcp) resultText += `• OVPN TCP: ${vpnData.port.ovpntcp}\n`;
                                if(vpnData.port.ovpnudp) resultText += `• OVPN UDP: ${vpnData.port.ovpnudp}\n`;
                                if(vpnData.port.slowdns) resultText += `• SlowDNS: ${vpnData.port.slowdns}\n`;
                                if(vpnData.port.sshohp) resultText += `• SSH OHP: ${vpnData.port.sshohp}\n`;
                                if(vpnData.port.ovpnohp) resultText += `• OVPN OHP: ${vpnData.port.ovpnohp}\n`;
                                if(vpnData.port.squid) resultText += `• Squid: ${vpnData.port.squid}\n`;
                                if(vpnData.port.udpcustom) resultText += `• UDP Custom: ${vpnData.port.udpcustom}\n`;
                                if(vpnData.port.udpgw) resultText += `• UDP GW: ${vpnData.port.udpgw}\n`;
                            }

                            // Port Khusus Vmess/Vless/Trojan
                            if(vpnData.port.ws_tls && vpnType !== 'ssh') resultText += `• WS TLS: ${vpnData.port.ws_tls}\n`;
                            if(vpnData.port.ws_none && vpnType !== 'ssh') resultText += `• WS Non-TLS: ${vpnData.port.ws_none}\n`;
                            if(vpnData.port.grpc && vpnType !== 'ssh') resultText += `• GRPC: ${vpnData.port.grpc}\n`;
                        }

                        // Path (Vmess/Vless/Trojan)
                        if (vpnData.path) {
                            resultText += `\n\`\`\`Informasi Path\`\`\`\n`;
                            if(vpnData.path.stn) resultText += `• Standar: ${vpnData.path.stn}\n`;
                            if(vpnData.path.multi) resultText += `• Multi: ${vpnData.path.multi}\n`;
                            if(vpnData.path.grpc) resultText += `• GRPC: ${vpnData.path.grpc}\n`;
                            if(vpnData.path.up) resultText += `• Upgrade: ${vpnData.path.up}\n`;
                        }

                        // Payload (SSH)
                        if (vpnData.payloadws) {
                            resultText += `\n\`\`\`Payload WS (CDN)\`\`\`\n`;
                            resultText += `\`\`\`${vpnData.payloadws.payloadcdn}\`\`\`\n`;
                            resultText += `\n\`\`\`Payload WS (Path)\`\`\`\n`;
                            resultText += `\`\`\`${vpnData.payloadws.payloadwithpath}\`\`\`\n`;
                        }

                        // Link Akun (Vmess/Vless/Trojan)
                        if (vpnData.link && vpnType !== 'ssh') {
                            resultText += `\n\`\`\`Link Akun (Klik untuk Salin)\`\`\`\n`;
                            if(vpnData.link.tls) resultText += `• TLS:\n\`\`\`${vpnData.link.tls}\`\`\`\n`;
                            if(vpnData.link.none) resultText += `• Non-TLS:\n\`\`\`${vpnData.link.none}\`\`\`\n`;
                            if(vpnData.link.grpc) resultText += `• GRPC:\n\`\`\`${vpnData.link.grpc}\`\`\`\n`;
                            if(vpnData.link.uptls) resultText += `• Upgrade TLS:\n\`\`\`${vpnData.link.uptls}\`\`\`\n`;
                            if(vpnData.link.upntls) resultText += `• Upgrade Non-TLS:\n\`\`\`${vpnData.link.upntls}\`\`\`\n`;
                        }
                        // --- Akhir Pembuatan Teks Output ---
                        
                        resultText += `\n💰 Harga: Rp ${totalPrice.toLocaleString('id-ID')}\n💳 Saldo: Rp ${updatedUser.balance.toLocaleString('id-ID')}`;
                        await sock.sendMessage(jid, { text: resultText.trim() });

                    } catch (error) {
                        await dbHelper.updateBalance(sender, totalPrice); // Kembalikan saldo jika gagal
                        console.error("VPN Create Err:", error.response?.data || error.message);
                        sock.sendMessage(jid, { text: `Gagal buat VPN. Saldo kembali.\nAlasan: ${error.response?.data?.meta?.message || error.message}`});
                    } finally {
                        delete vpnCreationSessions[sender];
                    }
                    // --- AKHIR BLOK PENGGANTI ---
                }
                return;
            }

            // --- BARU: Handler Sesi Renew VPN ---
            if (global.renewSessions[sender] && !body.startsWith('.')) {
                let session = global.renewSessions[sender];
                let userMessage = body.trim();
                
                try {
                    // Step 1: Menunggu Username
                    if (session.step === 'awaiting_username') {
                        let normalizedUsername = userMessage.toLowerCase().replace(/[^a-z0-9]/g, '');
                        if (normalizedUsername.length < 4) return sock.sendMessage(jid, { text: 'Username tidak valid. Ketik username yang benar.\nKetik .batalkan untuk batal.' });
                        
                        session.username = normalizedUsername;
                        session.step = 'awaiting_duration';
                        
                        // Opsi durasi (HARGA DAPAT ANDA UBAH DI SINI)
                        // HARGA SAYA SET DARI CONTOH ANDA (7 hari = 2k, 30 hari = 7k)
                        const renewOptions = [
                            { id: ".renewduration 7", text: "7 Hari - Rp 2.000" },
                            { id: ".renewduration 30", text: "30 Hari - Rp 7.000" }
                            // Tambahkan opsi lain jika perlu
                        ];
                        // Simpan harga (HARGA HARUS SAMA DENGAN DI ATAS)
                        session.prices = { 7: 2000, 30: 7000 }; 

                        await sendButtons(sock, jid, {
                            text: `✅ Username: *${normalizedUsername}*.\n\nSekarang pilih durasi perpanjangan:`,
                            buttons: renewOptions,
                            footer: "Ketik .batalkan untuk batal."
                        });
                        return;
                    }
                    
                    // Step 2: Menunggu Durasi (ini di-trigger oleh tombol .renewduration)
                    // Ini ditangani di switch case .renewduration (Bagian 7)
                    
                } catch (e) {
                    console.error("Renew Session Error:", e);
                    delete global.renewSessions[sender];
                    await sock.sendMessage(jid, { text: 'Terjadi kesalahan. Sesi perpanjangan dibatalkan.' });
                }
                return;
            }
            // --- AKHIR HANDLER RENEW ---


            // --- BARU: Handler Game Sessions ---
            if (global.gameSessions[jid] && !body.startsWith('.')) {
                const session = global.gameSessions[jid];
                const answer = body.trim().toLowerCase();

                // Handler Tebak Kata
                if (session.type === 'tebakkata') {
                     if (!session.participants.includes(sender)) session.participants.push(sender); // Catat partisipan
                     if (answer === session.data.kata) {
                         await reply(`🎉 Selamat @${sender.split('@')[0]}! Jawabanmu benar!\nKata yang benar adalah *${session.data.kata}*.`, { mentions: [sender] });
                         delete global.gameSessions[jid]; // Akhiri sesi
                     } else {
                         session.data.attemptsLeft--;
                         if (session.data.attemptsLeft > 0) {
                             await reply(`Jawaban salah! Sisa ${session.data.attemptsLeft} kesempatan.`);
                         } else {
                             await reply(`Kesempatan habis! Jawaban yang benar adalah *${session.data.kata}*.\n\nPartisipan: ${session.participants.map(p => `@${p.split('@')[0]}`).join(', ')}`, { mentions: session.participants });
                             delete global.gameSessions[jid];
                         }
                     }
                     return; // Hentikan proses
                }

                // Handler Trivia
                if (session.type === 'trivia') {
                    let correctAnswer = false;
                    // Jika ada pilihan ganda (options)
                    if (session.data.options) {
                        // Cek apakah jawaban adalah nomor pilihan
                        const choiceIndex = parseInt(answer) - 1;
                        if (!isNaN(choiceIndex) && choiceIndex >= 0 && choiceIndex < session.data.options.length) {
                             if (session.data.options[choiceIndex].toLowerCase() === session.data.answer.toLowerCase()) {
                                 correctAnswer = true;
                             }
                        } else { // Cek apakah jawaban adalah teks pilihan
                             if (answer === session.data.answer.toLowerCase()) {
                                correctAnswer = true;
                             }
                        }
                    } else { // Jika jawaban langsung
                        if (answer === session.data.answer.toLowerCase()) {
                             correctAnswer = true;
                        }
                    }

                    if (correctAnswer) {
                         clearTimeout(session.data.timeout); // Hentikan timeout
                         await reply(`✅ Benar! @${sender.split('@')[0]} menjawab dengan tepat!\nJawaban: *${session.data.answer}*`, { mentions: [sender] });
                         delete global.gameSessions[jid];
                    } else {
                         await reply(`Jawaban salah! Coba lagi.`); // Biarkan pemain lain mencoba
                    }
                    return;
                }

                // Handler Suit
                if (session.type === 'suit') {
                    if (session.data.player1 === sender || session.data.player2 === sender) {
                        const validChoices = ['batu', 'gunting', 'kertas'];
                        if (validChoices.includes(answer)) {
                            if (sender === session.data.player1 && !session.data.choice1) {
                                session.data.choice1 = answer;
                                await reply(`@${sender.split('@')[0]} telah memilih. Menunggu @${session.data.player2.split('@')[0]}...`, { mentions: [sender, session.data.player2] });
                            } else if (sender === session.data.player2 && !session.data.choice2) {
                                session.data.choice2 = answer;
                                await reply(`@${sender.split('@')[0]} telah memilih.`, { mentions: [sender] });
                            } else {
                                await reply('Anda sudah memilih!');
                            }

                            // Cek apakah kedua pemain sudah memilih
                            if (session.data.choice1 && session.data.choice2) {
                                clearTimeout(session.data.timeout); // Hentikan timeout
                                const p1 = session.data.player1;
                                const p2 = session.data.player2;
                                const c1 = session.data.choice1;
                                const c2 = session.data.choice2;
                                let winner = '';
                                let resultText = `*HASIL SUIT*\n\n@${p1.split('@')[0]}: ${c1}\n@${p2.split('@')[0]}: ${c2}\n\n`;

                                if (c1 === c2) {
                                    resultText += "Hasilnya Seri!";
                                } else if (
                                    (c1 === 'batu' && c2 === 'gunting') ||
                                    (c1 === 'gunting' && c2 === 'kertas') ||
                                    (c1 === 'kertas' && c2 === 'batu')
                                ) {
                                    winner = p1;
                                    resultText += `🏆 Pemenangnya @${p1.split('@')[0]}!`;
                                } else {
                                    winner = p2;
                                    resultText += `🏆 Pemenangnya @${p2.split('@')[0]}!`;
                                }
                                await reply(resultText, { mentions: [p1, p2] });
                                delete global.gameSessions[jid]; // Akhiri sesi suit
                            }
                        } else {
                            await reply('Pilihan tidak valid. Ketik: batu, gunting, atau kertas');
                        }
                    }
                     return;
                }
            }
            // --- AKHIR HANDLER GAME ---


            // --- 7. COMMAND HANDLER (SWITCH) ---
            const prefix = '.';
            if (!body.startsWith(prefix)) return;

            const args = body.slice(prefix.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const text = args.join(' ');

            const reply = (txt, options = {}) => sock.sendMessage(jid, { text: txt, ...options }, { quoted: msg }); // Ubah reply agar bisa terima options

            // Cek Permissions
            const cmdScope = dbHelper.getCommandPermission(command);
            if (cmdScope === 'off' && !isOwner) return reply(`Fitur ${command} dinonaktifkan.`);
            if (cmdScope === 'owner' && !isOwner) return reply('Khusus Owner.');
            if (cmdScope === 'private' && isGroup) return reply('Hanya di chat pribadi.');
            if (cmdScope === 'group' && !isGroup) return reply('Hanya di grup.');

            switch (command) {

                // --- Fitur Owner (Lengkap & Utuh) ---
                case 'addvpnserver': {
                    const [server_name, api_url, api_token] = args;
                    if (!server_name || !api_url || !api_token || !api_url.startsWith('http')) return reply('Format: .addvpnserver sg [http://1.2.3.4/vps](http://1.2.3.4/vps) TOKEN123');
                    await dbHelper.addVpnServer(server_name, api_url, api_token);
                    reply(`✅ Server VPN [${server_name}] ditambah/diperbarui.`);
                } break;
                case 'delvpnserver': {
                    const server_name = args[0]; if (!server_name) return reply('Format: .delvpnserver sg');
                    await dbHelper.delVpnServer(server_name); reply(`✅ Server VPN [${server_name}] dihapus.`);
                } break;
                case 'listvpnserver': {
                     const servers = await dbHelper.getAllVpnServers();
                     if (servers.length === 0) return reply('DB server VPN kosong.');
                     let txt = 'Daftar Server VPN & Harga:\n\n';
                     servers.forEach(s => {
                        txt += `*Nama:* ${s.server_name}\n*URL:* ${s.api_url}\n*Token:* ${s.api_token.substring(0, 5)}...\n`;
                        txt += ` SSH (R/P/S): ${s.price_ssh_regular}/${s.price_ssh_premium}/${s.price_ssh_stb}\n`; // Disingkat
                        txt += ` VMESS (R/P/S): ${s.price_vmess_regular}/${s.price_vmess_premium}/${s.price_vmess_stb}\n`;
                        txt += ` VLESS (R/P/S): ${s.price_vless_regular}/${s.price_vless_premium}/${s.price_vless_stb}\n`;
                        txt += ` TROJAN (R/P/S): ${s.price_trojan_regular}/${s.price_trojan_premium}/${s.price_trojan_stb}\n\n`;
                     });
                     reply(txt);
                } break;
                case 'setharga':
                case 'setvpnprice': {
                    const [serverName, vpnTypeOrAll, priceRegularStr, pricePremiumStr, priceStbStr] = args;
                    if (!serverName || !vpnTypeOrAll || !priceRegularStr || !pricePremiumStr || !priceStbStr) return reply('Format:\n.setharga [srv] [tipe/all] [reg] [prem] [stb]');
                    const priceRegular = parseInt(priceRegularStr); const pricePremium = parseInt(pricePremiumStr); const priceStb = parseInt(priceStbStr);
                    if (isNaN(priceRegular) || isNaN(pricePremium) || isNaN(priceStb)) return reply('Harga harus angka.');
                    const serverExists = await dbHelper.getVpnServer(serverName); if (!serverExists) return reply(`Server [${serverName}] tidak ada.`);
                    const vpnTypes = ['ssh', 'vmess', 'vless', 'trojan']; let typesToSet = [];
                    if (vpnTypeOrAll.toLowerCase() === 'all') typesToSet = vpnTypes;
                    else if (vpnTypes.includes(vpnTypeOrAll.toLowerCase())) typesToSet.push(vpnTypeOrAll.toLowerCase());
                    else return reply(`Tipe VPN tidak valid: ${vpnTypeOrAll}. Gunakan ssh, vmess, vless, trojan, atau all.`);
                    try {
                         let successMessages = [];
                         for (const type of typesToSet) {
                             await dbHelper.setVpnPrice(serverName, type, priceRegular, pricePremium, priceStb);
                             successMessages.push(`Harga ${type.toUpperCase()} [${serverName}]: ${priceRegular}/${pricePremium}/${priceStb}`);
                         }
                         reply(`✅ Harga Diatur:\n` + successMessages.join('\n'));
                    } catch (e) { reply(`Gagal: ${e.message}`); }
                } break;
                case 'addsaldo': {
                    const amount = parseInt(args[args.length - 1]);
                    let targetJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                    if (!targetJid || isNaN(amount)) return reply('Format: .addsaldo @user 5000');
                    const targetExists = await dbHelper.getUser(targetJid); if (!targetExists) return reply('User tidak ditemukan.');
                    await dbHelper.updateBalance(targetJid, amount); const targetUser = await dbHelper.getUser(targetJid);
                    await sock.sendMessage(jid, { text: `Sukses +${amount} ke @${targetJid.split('@')[0]}. Saldo baru: ${targetUser.balance}`, mentions: [targetJid] });
                    await sock.sendMessage(targetJid, { text: `Saldo +${amount} oleh Owner.` });
                } break;
                case 'delsaldo': {
                    const amount = parseInt(args[args.length - 1]);
                    let targetJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                    if (!targetJid || isNaN(amount)) return reply('Format: .delsaldo @user 5000');
                    const targetExists = await dbHelper.getUser(targetJid); if (!targetExists) return reply('User tidak ditemukan.');
                    await dbHelper.updateBalance(targetJid, -amount); const targetUser = await dbHelper.getUser(targetJid);
                    await sock.sendMessage(jid, { text: `Sukses -${amount} dari @${targetJid.split('@')[0]}. Saldo baru: ${targetUser.balance}`, mentions: [targetJid] });
                    await sock.sendMessage(targetJid, { text: `Saldo -${amount} oleh Owner.` });
                } break;
                case 'acctopup': {
                    const transactionId = args[0]; if (!transactionId) return reply('Format: .acctopup [ID_TRANSAKSI]');
                    let targetJid, amount, txKey;
                    for (const [key, value] of Object.entries(global.pendingTopups)) { if (value.id === transactionId) { targetJid = value.userId; amount = value.amount; txKey = key; break; } }
                    if (!txKey) return reply(`Transaksi ${transactionId} tidak ditemukan.`);
                    await dbHelper.updateBalance(targetJid, amount); await dbHelper.logTransaction(targetJid, 'TOPUP', 'Topup Saldo', amount); const targetUser = await dbHelper.getUser(targetJid);
                    await sock.sendMessage(jid, { text: `Sukses ACC topup ${amount} ke @${targetJid.split('@')[0]}. Saldo baru: ${targetUser.balance}`, mentions: [targetJid] });
                    await sock.sendMessage(targetJid, { text: `Topup ${amount} (ID: ${transactionId}) disetujui.\nSaldo baru: ${targetUser.balance}` });
                    delete global.pendingTopups[txKey];
                } break;
                case 'tolaktopup': {
                    const transactionId = args[0]; const alasan = args.slice(1).join(" ") || "N/A";
                    if (!transactionId) return reply('Format: .tolaktopup [ID] [alasan]');
                    let transaction, txKey; for (const [key, value] of Object.entries(global.pendingTopups)) { if (value.id === transactionId) { transaction = value; txKey = key; break; } }
                    if (!transaction) return reply(`ID ${transactionId} tidak ditemukan.`);
                    await reply(`Transaksi ${transactionId} ditolak.`);
                    await sock.sendMessage(transaction.userId, { text: `Topup Rp ${transaction.amount.toLocaleString('id-ID')} ditolak.\nAlasan: ${alasan}` });
                    delete global.pendingTopups[txKey];
                } break;
                case 'addprem': {
                    const durationInDays = parseInt(args[args.length - 1]);
                    let targetJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                    if (!targetJid || isNaN(durationInDays) || durationInDays <= 0) return reply('Format: .addprem @user 30');
                    const targetExists = await dbHelper.getUser(targetJid); if (!targetExists) return reply('User tidak ditemukan.');
                    await dbHelper.setPremium(targetJid, durationInDays);
                    await sock.sendMessage(jid, { text: `@${targetJid.split('@')[0]} premium ${durationInDays} hari.`, mentions: [targetJid] });
                    await sock.sendMessage(targetJid, { text: `Anda premium ${durationInDays} hari.` });
                } break;
                case 'delprem': {
                    let targetJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                    if (!targetJid) return reply('Format: .delprem @user');
                    const targetExists = await dbHelper.getUser(targetJid); if (!targetExists) return reply('User tidak ditemukan.');
                    await dbHelper.delPremium(targetJid);
                    await sock.sendMessage(jid, { text: `Premium @${targetJid.split('@')[0]} dihapus.`, mentions: [targetJid] });
                } break;
                case 'laporan':
                case 'ledger': {
                    let [range] = args; let daysAgo = 0; let title = "Hari Ini";
                    if (range === 'minggu') { daysAgo = 6; title = "Minggu Ini"; } else if (range === 'bulan') { daysAgo = 29; title = "Bulan Ini"; }
                    const ledger = await dbHelper.getLedger(daysAgo); if (ledger.length === 0) return reply(`Tidak ada pemasukan ${title}.`);
                    let totalPemasukan = 0; let reportText = `*Laporan ${title}*\n\n`;
                    ledger.forEach(item => {
                        reportText += `*${item.type}:* ${item.total_count} trans, Rp ${item.total_amount.toLocaleString('id-ID')}\n`;
                        if (item.type === 'TOPUP' || item.type === 'RESELLER_BUY' || item.type === 'VPN_RENEW') totalPemasukan += item.total_amount;
                    });
                    reportText += `\n*Total Pemasukan (Topup + Reseller + Renew):* Rp ${totalPemasukan.toLocaleString('id-ID')}`;
                    reply(reportText);
                } break;
                case 'clearledger': {
                     await sendButtons(sock, jid, { text: '❓ Yakin hapus SEMUA riwayat transaksi?', buttons: [ { id: '.confirmclearledger', text: '✅ YA, HAPUS' }, { id: '.batalkan', text: '❌ BATAL' } ] });
                } break;
                 case 'confirmclearledger': {
                    await dbHelper.clearLedger();
                    reply('✅ Semua riwayat transaksi dihapus.');
                } break;
                // Perintah .cancelclearledger dihapus, digabung ke .batalkan
                case 'addgroup': {
                    if (!jid.endsWith('@g.us')) return reply('Perintah ini hanya di grup.');
                    const success = await dbHelper.addGroupToWhitelist(jid);
                    reply(success ? `✅ Grup ini ditambahkan ke whitelist.` : 'Grup ini sudah whitelist.');
                } break;
                case 'delgroup': {
                     if (!jid.endsWith('@g.us')) return reply('Perintah ini hanya di grup.');
                     const success = await dbHelper.delGroupFromWhitelist(jid);
                     reply(success ? `✅ Grup ini dihapus dari whitelist.` : 'Gagal (grup tidak ada di whitelist).');
                } break;
                case 'listgroup': {
                     const groups = await dbHelper.getAllowedGroups();
                     if (groups.length === 0) return reply('Whitelist grup kosong.');
                     let txt = '*Grup Whitelist:*\n\n' + groups.map(g => `- ${g.jid}`).join('\n');
                     reply(txt);
                } break;
                case 'setcmdperm': {
                    const [cmdName, scope] = args;
                    const validScopes = ['all', 'private', 'group', 'owner', 'off'];
                    if (!cmdName || !scope || !validScopes.includes(scope.toLowerCase())) {
                        return reply(`Format salah.\n.setcmdperm [cmd] [scope]\nScope: ${validScopes.join(', ')}`);
                    }
                    try {
                        await dbHelper.setCommandPermission(cmdName.toLowerCase(), scope.toLowerCase());
                        reply(`✅ Izin .${cmdName} diatur ke: ${scope.toUpperCase()}`);
                    } catch (e) { reply(`Gagal: ${e.message}`); }
                } break;
                case 'blacklist':
                case 'ban': {
                     let targetJid; let reason = args.slice(1).join(' ') || 'N/A';
                     if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
                     else if (args[0]) targetJid = args[0].endsWith('@g.us') ? args[0] : (args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                     else return reply('Format: .blacklist [@user/nomor/jid_grup] [alasan]');
                     if (OWNER_NUMBERS.includes(targetJid.split('@')[0])) return reply('Tidak bisa blacklist Owner.');
                     const success = await dbHelper.addToBlacklist(targetJid, reason);
                     reply(success ? `✅ JID ${targetJid} diblacklist. Alasan: ${reason}` : 'JID sudah blacklist.');
                } break;
                case 'unblacklist':
                case 'unban': {
                     let targetJid;
                     if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
                     else if (args[0]) targetJid = args[0].endsWith('@g.us') ? args[0] : (args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                     else return reply('Format: .unblacklist [@user/nomor/jid_grup]');
                     const success = await dbHelper.removeFromBlacklist(targetJid);
                     reply(success ? `✅ JID ${targetJid} dihapus dari blacklist.` : 'Gagal (JID tidak di blacklist).');
                } break;
                case 'listblacklist':
                case 'listban': {
                     const list = await dbHelper.getBlacklist(); if (list.length === 0) return reply('Blacklist kosong.');
                     let txt = '*Daftar Blacklist:*\n\n' + list.map(item => `- JID: ${item.jid}\n  Alasan: ${item.reason}`).join('\n');
                     reply(txt);
                } break;
                case 'botstats': {
                    const stats = await dbHelper.getBotStats();
                    const uptime = process.uptime(); const uptimeFormatted = moment.duration(uptime, 'seconds').humanize();
                    let statsText = `📊 *Statistik Bot ${botName}*\n\n` + `• Total User: ${stats.totalUsers}\n` + `• Premium Aktif: ${stats.premiumUsers}\n` +
                                    `• Penjualan Hari Ini: Rp ${stats.salesToday.toLocaleString('id-ID')}\n` + `• Topup Hari Ini: Rp ${stats.topupToday.toLocaleString('id-ID')}\n` +
                                    `• Waktu Aktif: ${uptimeFormatted}\n` + `• Maintenance: ${isMaintenance() ? '🔴 ON' : '🟢 OFF'}\n` +
                                    `• Grup Whitelist: ${global.allowedGroups.size}\n` + `• JID Blacklist: ${global.blacklistedUsers.size}`;
                    reply(statsText);
                } break;
                case 'createvoucher': {
                     const [amountStr, code] = args; const amount = parseInt(amountStr);
                     if (!amount || isNaN(amount) || amount <= 0 || !code || code.length < 5) return reply('Format: .createvoucher [jumlah] [kode_unik]\n(Kode min 5 char)');
                     const existing = await dbHelper.getVoucher(code); if (existing) return reply(`Kode '${code}' sudah ada.`);
                     await dbHelper.createVoucher(code, amount); reply(`✅ Voucher Dibuat!\nKode: *${code}*\nSaldo: Rp ${amount.toLocaleString('id-ID')}`);
                } break;
                case 'maintenance': {
                     const mode = args[0]?.toLowerCase();
                     if (mode === 'on') { global.isMaintenanceMode = true; reply('🔴 Maintenance ON.'); }
                     else if (mode === 'off') { global.isMaintenanceMode = false; reply('🟢 Maintenance OFF.'); }
                     else { reply(`Mode: ${isMaintenance() ? '🔴 ON' : '🟢 OFF'}\nPakai .maintenance [on/off]`); }
                } break;
                // ---------------------------------------------


                // --- MENU UTAMA (Gaya GRN, List + Button) ---
                case 'menu':
                case 'help': {

                    let roleText = '👤 User Biasa';
                    if (isPrem && !isOwner) roleText = '🎖️ Reseller Premium';
                    if (isOwner) roleText = '👑 Developer';
                    const welcomeText = `*ꜱᴇʟᴀᴍᴀᴛ ᴅᴀᴛᴀɴɢ ᴅɪ ${ownername.toUpperCase()} 👋*\n\n` + `┏━━━❏ *ɪɴꜰᴏ ᴜꜱᴇʀ* ❏━━━┓\n` +
                                       `│ 💁‍♀️ ɴᴀᴍᴀ : ${pushName}\n` + `│ 💵 ꜱᴀʟᴅᴏ : *Rp ${user.balance.toLocaleString('id-ID')}*\n` +
                                       `│ 📱 ɴᴏᴍᴏʀ : *${user.verified_number ? user.verified_number : 'Belum Terverifikasi (.verifotp)'}*\n` + `│ ${roleText}\n` +
                                       `┗━━━━━━━━━━━━━━━┛\n\n` + `⚠️ *ᴍᴀsɪʜ ᴅᴀʟᴀᴍ ᴘᴇɴɢᴇᴍʙᴀɴɢᴀɴ..*\n` + `ʙᴏᴛ ɪɴɪ ꜱᴇᴅᴀɴɢ ᴀᴋᴛꜰ ᴅɪᴋᴇᴍʙᴀɴɢᴋᴀɴ.\n` +
                                       `ᴍᴏʜᴏɴ ᴘᴇɴɢᴇʀᴛɪᴀɴɴʏᴀ ᴊɪᴋᴀ ᴛᴇʀᴊᴀᴅɪ ʙᴜɢ ᴀᴛᴀᴜ ᴋᴇꜱᴀʟᴀʜᴀɴ 🙏\n` + `ᴋᴀᴍɪ ꜱᴀɴɢᴀᴛ ᴍᴇɴʜᴀʀɢᴀɪ ᴅᴜᴋᴜɴɢᴀɴ ᴅᴀɴ ᴍᴀꜱᴜᴋᴀɴɴʏᴀ! ❤️\n\n` +
                                       `\`📩 *ᴊɪᴋᴀ ᴋᴀᴍᴜ ᴍᴇɴᴇᴍᴜᴋᴀɴ ʙᴜɢ,* ꜱɪʟᴀᴋᴀɴ ʟᴀɴɢꜱᴜɴɢ ʜᴜʙᴜɴɢɪ ᴏᴡɴᴇʀ ʙᴏᴛ 🤝\`\n\n` + `\`𝐏𝐚𝐬𝐭𝐢𝐤𝐚𝐧 𝐧𝐨𝐦𝐨𝐫 𝐚𝐧𝐝𝐚 𝐲𝐚𝐧𝐠 𝐭𝐞𝐫𝐯𝐞𝐫𝐢𝐟𝐢𝐤𝐚𝐬𝐢 𝐭𝐢𝐝𝐚𝐤 𝐬𝐚𝐥𝐚𝐡!\``;

                    const userRows = {
                        akun: [ { id: ".ceksaldo", title: "Cek Saldo" }, { id: ".topup ", title: "Topup Saldo (min 5k)" }, { id: ".history", title: "Riwayat Transaksi" }, { id: ".redeem ", title: "Redeem Voucher" } ],
                        layanan: [ { id: ".vpnmenu", title: "Menu VPN" }, { id: ".cekkuota ", title: "Cek Kuota XL" } ],
                        upgrade: [ { id: ".joinreseller", title: "Gabung Reseller" } ],
                        game: [ { id: ".tebakkata", title: "Tebak Kata" }, { id: ".trivia", title: "Trivia" }, { id: ".suit ", title: "Suit (vs Bot/Player)" } ], // Game
                        bantuan: [ { id: ".carapakai", title: "Cara Pakai" }, { id: ".lapor ", title: "Lapor Owner" }, { id: ".donasi", title: "Donasi" }, { id: ".kontak", title: "Kontak" }, { id: ".pinterest ", title: "Cari Gambar" }, { id: ".referral", title: "Undang Teman (Grup)" } ]
                    };
                    const premRows = {
                        akun: [ { id: ".ceksaldo", title: "Cek Saldo (Premium)" }, { id: ".topup ", title: "Topup Saldo (min 10k)" }, { id: ".history", title: "Riwayat Transaksi" }, { id: ".redeem ", title: "Redeem Voucher" }],
                        layanan: [ { id: ".vpnmenu", title: "Menu VPN (Harga Prem)" }, { id: ".cekkuota ", title: "Cek Kuota XL" } ],
                        reseller: [ { id: ".cekpenjualan", title: "Cek Penjualan" } ],
                        game: userRows.game, // Game bisa dimainkan semua
                        bantuan: userRows.bantuan
                    };
                    const ownerRows = {
                        saldo: [ { id: ".addsaldo ", title: "Tambah Saldo" }, { id: ".delsaldo ", title: "Kurangi Saldo" }, { id: ".acctopup ", title: "Terima Topup" }, { id: ".tolaktopup ", title: "Tolak Topup" }, { id: ".createvoucher ", title: "Buat Voucher" } ],
                        reseller: [ { id: ".addprem ", title: "Tambah Premium" }, { id: ".delprem ", title: "Hapus Premium" } ],
                        vpn: [ { id: ".addvpnserver ", title: "Tambah Server" }, { id: ".delvpnserver ", title: "Hapus Server" }, { id: ".listvpnserver", title: "List Server" }, { id: ".setharga ", title: "Set Harga VPN" } ],
                        ledger: [ { id: ".laporan", title: "Laporan Harian" }, { id: ".laporan minggu", title: "Laporan Mingguan" }, { id: ".laporan bulan", title: "Laporan Bulanan" }, { id: ".clearledger", title: "Hapus Ledger" } ],
                        kontrol: [ { id: ".addgroup", title: "Whitelist Grup Ini" }, { id: ".delgroup", title: "Hapus Whitelist Grup Ini" }, { id: ".listgroup", title: "List Whitelist Grup" }, { id: ".setcmdperm ", title: "Set Izin Cmd" }, { id: ".blacklist ", title: "Blacklist User/Grup" }, { id: ".unblacklist ", title: "Unblacklist User/Grup" }, { id: ".listblacklist", title: "List Blacklist" }, { id: ".maintenance ", title: "Mode Maintenance" }, { id: ".botstats", title: "Statistik Bot" }]
                    };

                    let sections;
                    if (isOwner) {
                         sections = [
                            { title: "Manajemen Saldo & Voucher", rows: ownerRows.saldo }, { title: "Manajemen Reseller", rows: ownerRows.reseller },
                            { title: "Manajemen VPN", rows: ownerRows.vpn }, { title: "Laporan (Ledger)", rows: ownerRows.ledger },
                            { title: "Kontrol Akses & Status Bot", rows: ownerRows.kontrol },
                            { title: "Menu User: Akun", rows: userRows.akun }, { title: "Menu User: Layanan", rows: userRows.layanan },
                            { title: "Menu User: Game", rows: userRows.game }, { title: "Menu User: Bantuan", rows: userRows.bantuan } // Tambah game
                        ];
                    } else if (isPrem) {
                         sections = [
                            { title: "Akun & Saldo (Premium)", rows: premRows.akun }, { title: "Layanan (Harga Reseller)", rows: premRows.layanan },
                            { title: "Fitur Reseller", rows: premRows.reseller },
                            { title: "Game Grup", rows: premRows.game }, { title: "Bantuan", rows: premRows.bantuan } // Tambah game
                        ];
                    } else {
                        sections = [
                            { title: "Akun & Saldo", rows: userRows.akun }, { title: "Layanan", rows: userRows.layanan },
                            { title: "Upgrade", rows: userRows.upgrade }, { title: "Game Grup", rows: userRows.game }, { title: "Bantuan", rows: userRows.bantuan } // Tambah game
                        ];
                    }

                    // 1. Kirim Pesan List Utama
                    await sendInteractiveMessage(sock, jid, {
                        text: welcomeText, footer: `© ${ownername}`,
                        interactiveButtons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: "Pilih Opsi", sections: sections }) }]
                    }, { quoted: msg });

                    // 2. Kirim Pesan Tombol Quick Reply
                    await sendButtons(sock, jid, {
                        text: `\n_⚡ Powered by ${botName}_`,
                        buttons: [ { id: '.owner', text: '👤 OWNER' }, { id: '.donasi', text: '❤️ DONASI' }, { id: '.ping', text: '📶 PING' } ]
                    });

                }
                break;

                // (Case .ping dan .owner UTUH)
                case 'ping': { const startTime = Date.now(); await reply('Pong!'); const endTime = Date.now(); await reply(`Speed: ${endTime - startTime} ms`); } break;
                case 'owner': { let ownerText = '*Nomor Owner:*\n' + OWNER_NUMBERS.map(num => `- wa.me/${num}`).join('\n'); reply(ownerText); } break;

                // --- Fitur User (Lengkap & Utuh) ---
                case 'history':
                case 'riwayat': {
                    const transactions = await dbHelper.getTransactions(sender); if (transactions.length === 0) return reply('Tidak ada riwayat transaksi (60 hari).');
                    let historyText = '*Riwayat Transaksi (60 Hari Terakhir)*\n\n';
                    transactions.forEach(tx => {
                        const date = moment(tx.timestamp).tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm');
                        historyText += `*${date}* | ${tx.type}\n_${tx.product_name}_ | Rp ${tx.amount.toLocaleString('id-ID')}\n\n`;
                    });
                    reply(historyText.trim());
                } break;
                case 'lapor': {
                    if (jid.endsWith('@g.us')) return reply("Hanya di chat pribadi.");
                    if (contactOwnerSessions[sender]) return reply("Sesi chat sedang berlangsung. Ketik `.selesai`.");
                    const laporan = text; if (laporan.length < 10) return reply('Laporan terlalu pendek.');
                    contactOwnerSessions[sender] = true;
                    const laporText = `*PESAN BARU DARI USER*\n\n*Dari:* ${pushName} (${sender.split('@')[0]})\n*Pesan:* ${laporan}\n\n_(Reply .selesai)_`;
                    for (const owner of OWNER_NUMBERS) await sock.sendMessage(owner + '@s.whatsapp.net', { text: laporText, mentions: [jid] });
                    reply('Pesan Anda diteruskan ke Owner. Anda dalam mode chat.\nKetik `.selesai` untuk mengakhiri.');
                } break;
                case 'selesai': {
                    if (contactOwnerSessions[sender]) {
                        delete contactOwnerSessions[sender];
                        for (const owner of OWNER_NUMBERS) await sock.sendMessage(owner + '@s.whatsapp.net', { text: `User ${pushName} (${sender.split('@')[0]}) mengakhiri sesi.` });
                        reply("Sesi chat diakhiri.");
                    } else reply("Tidak ada sesi chat.");
                } break;
                case 'topup': {
                    const jumlah = parseInt(args[0]); const minTopup = isPrem ? 10000 : 5000;
                    if (isNaN(jumlah) || jumlah < minTopup) return reply(`Format: *.topup [jumlah]* (Min ${minTopup.toLocaleString('id-ID')})`);
                    if (!fs.existsSync(QRIS_IMAGE_PATH)) return reply(`QRIS non-aktif. Hubungi Owner.`);
                    const idTopup = `TP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                    global.pendingTopups[idTopup] = { id: idTopup, amount: jumlah, userId: sender, pushName: pushName, status: 'pending' };

                     const notifOwnerText = `*PERMINTAAN TOPUP BARU*\n\nDari: ${pushName} (${sender.split('@')[0]})\nJumlah: Rp ${jumlah.toLocaleString('id-ID')}\nID: \`${idTopup}\`\n_(Menunggu bukti)_`;
                    for (const owner of OWNER_NUMBERS) await sock.sendMessage(owner + '@s.whatsapp.net', { text: notifOwnerText });

                    const qrisMedia = fs.readFileSync(QRIS_IMAGE_PATH);
                    const captionToUser = `*TOPUP DIBUAT*\n\nBayar: *Rp ${jumlah.toLocaleString('id-ID')}*\nID: \`${idTopup}\`\n\n*KIRIM BUKTI TF (GAMBAR) DI SINI*`;
                    await sock.sendMessage(jid, { image: qrisMedia, caption: captionToUser });
                } break;
                case 'carapakai': {
                    const caraText = `--- CARA PAKAI BOT ---\n1. *.menu* (Lihat semua perintah)\n2. *.ceksaldo*\n3. *.topup [jumlah]*\n4. *.vpnmenu*\n5. *.cekkuota 08...*\n6. *.history*\n7. *.lapor [pesan]*`;
                    await sock.sendMessage(jid, { text: caraText });
                } break;
                case 'cekkuota': {
                    let msisdn = args[0]; if (!msisdn) return reply("Format: *.cekkuota 08...*");
                    msisdn = msisdn.replace(/[^0-9]/g, ''); if (msisdn.startsWith('62')) msisdn = '0' + msisdn.slice(2);
                    if (!msisdn.startsWith('08')) return reply("Nomor tidak valid.");
                    await reply("Mengecek kuota...");
                    try {
                        const ts = Date.now() + 10000; const input = `${msisdn}.${ts}`;
                        const signature = crypto.createHmac("sha256", CEKKUOTA_SECRET).update(input).digest("hex");
                        const payload = { msisdn: msisdn, timestamp: ts };
                        const options = { method: 'POST', url: CEKKUOTA_URL, headers: { 'authorization': `Bearer ${signature}`, 'content-type': 'application/json' }, data: payload };
                        const response = await axios(options); const result = response.data;
                        if (!result.status || !result.data) return reply("Gagal cek kuota.");
                        const data = result.data; let replyText = `*Kuota ${data.msisdn}*\nOp: ${data.operator}\nAktif: ${data.active_period}\nTenggang: ${data.grace_period}\n\n`;
                        data.quotas.forEach(p => { replyText += `*${p.name}*\n`; p.details.forEach(d => { replyText += ` - ${d.remaining_quota}/${d.total_quota} (${d.benefit})\n`; }); replyText += `\n`; });
                        await sock.sendMessage(jid, { text: replyText.trim() });
                    } catch (error) { await sock.sendMessage(jid, { text: "Server cek kuota error." }); }
                } break;
                case 'redeem': {
                     const code = args[0];
                     if (!code) return reply('Format: .redeem [kode_voucher]');
                     const voucher = await dbHelper.getVoucher(code);
                     if (!voucher) return reply('Kode voucher tidak valid.');
                     if (voucher.used_by) return reply(`Voucher sudah dipakai oleh ${voucher.used_by.split('@')[0]} pada ${moment(voucher.used_at).tz('Asia/Jakarta').format('DD/MM/YY HH:mm')}.`);
                     try {
                         await dbHelper.updateBalance(sender, voucher.amount);
                         await dbHelper.useVoucher(code, sender);
                         const updatedUser = await dbHelper.getUser(sender);
                         reply(`✅ Berhasil redeem!\nSaldo +Rp ${voucher.amount.toLocaleString('id-ID')}.\nSaldo baru: Rp ${updatedUser.balance.toLocaleString('id-ID')}`);
                     } catch (e) { reply(`Gagal redeem: ${e.message}`); }
                } break;

                // --- FITUR PLUGIN (Donasi, Kontak, Pinterest - Lengkap & Utuh) ---
                case 'kontak': {
                    const textKontak = 'Silakan hubungi kami melalui:';
                    const noHP = '+6287786388052'; const email = 'support@grnstore.com';
                    await sendInteractiveMessage(sock, jid, {
                        text: textKontak, footer: `© ${ownername}`,
                        interactiveButtons: [
                             { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '💬 Chat WhatsApp', url: `https://wa.me/${OWNER_NUMBERS[0]}` }) },
                             { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: '✉️ Salin Email', copy_code: email }) },
                             { name: 'cta_call', buttonParamsJson: JSON.stringify({ display_text: '📞 Telepon', phone_number: noHP }) }
                        ]
                    });
                } break;
                case 'pinterest': {
                    if (!text) return reply('Contoh: .pinterest aesthetic'); await reply(`Mencari "${text}"...`);
                    try {
                        const results = await pinterest(text); const randomImage = results[Math.floor(Math.random() * results.length)];
                        if (!randomImage) return reply('Gambar tidak ditemukan.');
                        await sock.sendMessage(jid, { image: { url: randomImage.image }, caption: `Hasil: ${text}` });
                        await sendButtons(sock, jid, { text: 'Cari lagi?', footer: `© ${ownername}`, buttons: [ { id: `.pinterest ${text}`, text: 'CARI LAGI' }, { id: `.menu`, text: 'Menu' } ] });
                    } catch (e) { await reply('Gagal mencari gambar.'); }
                } break;
                case 'qris': {
                    if (!fs.existsSync(QRIS_IMAGE_PATH)) return reply('File qris.png tidak ditemukan.');
                    try {
                        const media = await prepareWAMessageMedia({ image: fs.readFileSync(QRIS_IMAGE_PATH) }, { upload: sock.waUploadToServer });
                        const interactiveMessage = {
                            body: { text: 'Scan QRIS di atas untuk donasi.' }, footer: { text: 'Terima kasih!' },
                            header: { title: 'DONASI VIA QRIS', hasMediaAttachment: true, imageMessage: media.imageMessage },
                            nativeFlowMessage: { buttons: [ { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Sudah Bayar', id: '.terimakasih' }) } ] }
                        };
                        await sendInteractiveMessage(sock, jid, { interactiveMessage: interactiveMessage }, { quoted: msg });
                    } catch (e) { console.error("Gagal kirim QRIS:", e); await reply('Gagal menampilkan QRIS.'); }
                } break;
                 case 'terimakasih': { reply('Terima kasih telah berdonasi!'); } break;
                case 'donasi': {
                    await sock.sendMessage(jid, { react: { text: `⏱️`, key: msg.key } });
                    const danaPath = QRIS_IMAGE_PATH; const gopayPath = QRIS_IMAGE_PATH; const qrisPath = QRIS_IMAGE_PATH;
                    if (!fs.existsSync(danaPath)) return reply("Error: File qris.png tidak ditemukan.");
                    try {
                        let message = generateWAMessageFromContent(jid, {
                            viewOnceMessage: {
                                message: {
                                    interactiveMessage: {
                                        body: { text: `Pilih metode pembayaran:` }, footer: { text: `© ${ownername}`},
                                        carouselMessage: {
                                            cards: [
                                                { header: proto.Message.InteractiveMessage.Header.create({ ...(await prepareWAMessageMedia({ image: fs.readFileSync(danaPath) }, { upload: sock.waUploadToServer })), title: "DANA", subtitle: ownername, hasMediaAttachment: true }), body: { text: `> A/N: ${global_andana}` }, nativeFlowMessage: { buttons: [{ name: "cta_copy", buttonParamsJson: JSON.stringify({ display_text: "Salin Nomor DANA", copy_code: global_nodana }) }] } },
                                                { header: proto.Message.InteractiveMessage.Header.create({ ...(await prepareWAMessageMedia({ image: fs.readFileSync(gopayPath) }, { upload: sock.waUploadToServer })), title: "GOPAY", subtitle: ownername, hasMediaAttachment: true }), body: { text: `> A/N: ${global_angopay}` }, nativeFlowMessage: { buttons: [{ name: "cta_copy", buttonParamsJson: JSON.stringify({ display_text: "Salin Nomor GOPAY", copy_code: global_nogopay }) }] } },
                                                { header: proto.Message.InteractiveMessage.Header.create({ ...(await prepareWAMessageMedia({ image: fs.readFileSync(qrisPath) }, { upload: sock.waUploadToServer })), title: "QRIS", subtitle: ownername, hasMediaAttachment: true }), body: { text: `> SCAN di atas / klik tombol Saweria` }, nativeFlowMessage: { buttons: [{ name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: "Buka Saweria", url: saweriaLink }) }] } }
                                            ], messageVersion: 1
                                        }
                                    }
                                }
                            }
                        }, { quoted: msg });
                        await sock.relayMessage(message.key.remoteJid, message.message, { messageId: message.key.id });
                    } catch (e) { console.error("Gagal kirim donasi carousel:", e); await reply('Gagal memuat menu donasi.'); }
                } break;

                // --- RESELLER (Lengkap & Utuh) ---
                case 'joinreseller':
                case 'reseller': {
                    if (isPrem) return reply("Anda sudah premium.");
                    const resellerMenuText = `👑 *Gabung Reseller Premium!* 👑\n\nKeuntungan:\n- Harga khusus VPN\n- Min topup 10k\n\n👇 *Pilih Paket:*`;
                    await sendInteractiveMessage(sock, jid, {
                        text: resellerMenuText, footer: `© ${ownername}`,
                        interactiveButtons: [
                            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: `💎 1 Bulan - Rp 11.500`, id: `.buyreseller 1` }) },
                            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: `💎 3 Bulan - Rp 30.000`, id: `.buyreseller 3` }) },
                             { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: `💎 6 Bulan - Rp 55.000`, id: `.buyreseller 6` }) },
                            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: `💎 1 Tahun - Rp 99.000`, id: `.buyreseller 12` }) }
                        ]
                    }, { quoted: msg });
                } break;
                case 'buyreseller': {
                    if (isPrem) return reply("Anda sudah premium.");
                    const duration = parseInt(args[0]); if (isNaN(duration) || ![1, 3, 6, 12].includes(duration)) return reply("Paket tidak valid.");
                    let price = 0; let durationInDays = 0;
                    switch (duration) { case 1: price = 11500; durationInDays = 30; break; case 3: price = 30000; durationInDays = 90; break; case 6: price = 55000; durationInDays = 180; break; case 12: price = 99000; durationInDays = 365; break; }
                    if (user.balance < price) return reply(`Saldo tidak cukup! (Butuh Rp ${price.toLocaleString('id-ID')})`);
                    global.resellerPurchaseSessions[sender] = { price: price, durationInDays: durationInDays, durationText: `${duration} bulan` };
                    const confirmationText = `*KONFIRMASI PEMBELIAN*\n\nPaket: *${global.resellerPurchaseSessions[sender].durationText}*\nHarga: *Rp ${price.toLocaleString('id-ID')}*\n\nSaldo akan dipotong. Lanjutkan?`;
                    await sendInteractiveMessage(sock, jid, {
                        text: confirmationText, footer: `© ${ownername}`,
                        interactiveButtons: [ { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: `✅ Ya, Lanjutkan`, id: `.confirmreseller` }) }, { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: `❌ Batalkan`, id: `.batalkan` }) } ]
                    }, { quoted: msg });
                } break;
                case 'confirmreseller': {
                    const session = global.resellerPurchaseSessions[sender];
                    if (!session) return reply("Sesi tidak ditemukan."); if (user.balance < session.price) return reply("Saldo tidak cukup.");
                    await dbHelper.updateBalance(sender, -session.price); await dbHelper.setPremium(sender, session.durationInDays);
                    await dbHelper.logTransaction(sender, 'RESELLER_BUY', `Reseller ${session.durationText}`, session.price);
                    delete global.resellerPurchaseSessions[sender]; const updatedUser = await dbHelper.getUser(sender);
                    await reply(`🎉 *Selamat! Anda Sekarang Reseller Premium!*\nDurasi: ${session.durationText}\nSisa Saldo: Rp ${updatedUser.balance.toLocaleString('id-ID')}`);
                } break;
                // Perintah .batalreseller dihapus, digabung ke .batalkan
                case 'cekpenjualan': {
                    if (!isPrem) return reply('Khusus Reseller Premium.');
                    let [range] = args; let daysAgo = 0; let title = "Hari Ini";
                    if (range === 'minggu') { daysAgo = 6; title = "Minggu Ini"; } else if (range === 'bulan') { daysAgo = 29; title = "Bulan Ini"; }
                    const sales = await dbHelper.getResellerSales(sender, daysAgo);
                    if (sales.length === 0) return reply(`Anda belum ada penjualan VPN ${title}.`);
                    let salesText = `*Riwayat Penjualan VPN Anda (${title})*\n\n`; let totalSalesAmount = 0;
                    sales.forEach(sale => { const date = moment(sale.timestamp).tz('Asia/Jakarta').format('DD/MM/YY HH:mm'); salesText += `*${date}* | ${sale.product_name} | Rp ${sale.amount.toLocaleString('id-ID')}\n`; totalSalesAmount += sale.amount; });
                    salesText += `\n*Total:* ${sales.length} trans, Rp ${totalSalesAmount.toLocaleString('id-ID')}`; reply(salesText);
                } break;


                // --- Fitur OTP (Lengkap & Utuh) ---
                case 'verifotp': {
                    if (jid.endsWith('@g.us')) return reply("Hanya di chat pribadi.");
                    if (otpSessions[sender]) return reply("Sesi verifikasi sedang berjalan. Ketik .batalkan untuk batal.");
                    otpSessions[sender] = { stage: 'waiting_for_phone', phone: null, attempts: 0 };
                    reply("Masukkan nomor HP Anda (Format: 08xxxxxxxxxx)\nKetik .batalkan untuk batal.");
                } break;
                // Perintah .batalverif dihapus, digabung ke .batalkan

                // --- Fitur Saldo (Lengkap & Utuh) ---
                case 'ceksaldo':
                case 'saldo': { reply(`Saldo Anda: *Rp ${user.balance.toLocaleString('id-ID')}*`); } break;

                // --- Fitur VPN (Lengkap & Utuh) ---
                case 'vpnmenu': {
                    const servers = await dbHelper.getAllVpnServers(); if (servers.length === 0) return reply('Server VPN belum terdaftar.');
                    let paidVpnRows = []; let stbVpnRows = []; let trialVpnRows = []; let renewRows = [];
                    
                    for (const server of servers) {
                         const sName = server.server_name.toUpperCase(); const sNameLow = server.server_name.toLowerCase();
                         const priceSsh = (await dbHelper.getVpnPrice(sNameLow, 'ssh', false, isPrem)).toLocaleString('id-ID');
                         const priceSshStb = (await dbHelper.getVpnPrice(sNameLow, 'ssh', true, false)).toLocaleString('id-ID');
                         const priceVmess = (await dbHelper.getVpnPrice(sNameLow, 'vmess', false, isPrem)).toLocaleString('id-ID');
                         const priceVmessStb = (await dbHelper.getVpnPrice(sNameLow, 'vmess', true, false)).toLocaleString('id-ID');
                         const priceVless = (await dbHelper.getVpnPrice(sNameLow, 'vless', false, isPrem)).toLocaleString('id-ID');
                         const priceVlessStb = (await dbHelper.getVpnPrice(sNameLow, 'vless', true, false)).toLocaleString('id-ID');
                         const priceTrojan = (await dbHelper.getVpnPrice(sNameLow, 'trojan', false, isPrem)).toLocaleString('id-ID');
                         const priceTrojanStb = (await dbHelper.getVpnPrice(sNameLow, 'trojan', true, false)).toLocaleString('id-ID');

                         paidVpnRows.push({ id: `.ssh ${sNameLow}`, title: `SSH ${sName}`, description: `3 IP | Rp ${priceSsh}` });
                         paidVpnRows.push({ id: `.vmess ${sNameLow}`, title: `VMESS ${sName}`, description: `3 IP, 400GB | Rp ${priceVmess}` });
                         paidVpnRows.push({ id: `.vless ${sNameLow}`, title: `VLESS ${sName}`, description: `3 IP, 400GB | Rp ${priceVless}` });
                         paidVpnRows.push({ id: `.trojan ${sNameLow}`, title: `TROJAN ${sName}`, description: `3 IP, 400GB | Rp ${priceTrojan}` });
                         stbVpnRows.push({ id: `.stbssh ${sNameLow}`, title: `SSH STB ${sName}`, description: `7 IP | Rp ${priceSshStb}` });
                         stbVpnRows.push({ id: `.stbvmess ${sNameLow}`, title: `VMESS STB ${sName}`, description: `7 IP, 900GB | Rp ${priceVmessStb}` });
                         stbVpnRows.push({ id: `.stbvless ${sNameLow}`, title: `VLESS STB ${sName}`, description: `7 IP, 900GB | Rp ${priceVlessStb}` });
                         stbVpnRows.push({ id: `.stbtrojan ${sNameLow}`, title: `TROJAN STB ${sName}`, description: `7 IP, 900GB | Rp ${priceTrojanStb}` });
                         trialVpnRows.push({ id: `.trialssh ${sNameLow}`, title: `Trial SSH ${sName}`, description: "Gratis 1 jam" });
                         trialVpnRows.push({ id: `.trialvmess ${sNameLow}`, title: `Trial VMESS ${sName}`, description: "Gratis 1 jam" });
                         trialVpnRows.push({ id: `.trialvless ${sNameLow}`, title: `Trial VLESS ${sName}`, description: "Gratis 1 jam" });
                         trialVpnRows.push({ id: `.trialtrojan ${sNameLow}`, title: `Trial TROJAN ${sName}`, description: "Gratis 1 jam" });
                         
                         // BARIS RENEW BARU
                         renewRows.push({ id: `.renew ssh ${sNameLow}`, title: `Perpanjang SSH ${sName}` });
                         renewRows.push({ id: `.renew vmess ${sNameLow}`, title: `Perpanjang VMESS ${sName}` });
                         renewRows.push({ id: `.renew vless ${sNameLow}`, title: `Perpanjang VLESS ${sName}` });
                         renewRows.push({ id: `.renew trojan ${sNameLow}`, title: `Perpanjang TROJAN ${sName}` });
                    }
                    let titleText = `*VPN Store* 🚀\nBatas Trial: ${isPrem ? 10 : 4}x`;
                     await sendInteractiveMessage(sock, jid, {
                        text: titleText, footer: `© ${ownername}`,
                        interactiveButtons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: "Pilih VPN", sections: [ { title: "Paket Biasa (30 Hari)", rows: paidVpnRows }, { title: "Paket STB (30 Hari)", rows: stbVpnRows }, { title: "Perpanjang Akun (Renew)", rows: renewRows }, { title: "Akun Percobaan (1 Jam)", rows: trialVpnRows } ] }) }]
                    }, { quoted: msg });
                } break;
                // Perintah Beli
                case 'vless': case 'vmess': case 'trojan': case 'ssh': {
                    if (vpnCreationSessions[sender]) return reply('Sesi VPN berjalan. Ketik .batalkan');
                    if (renewSessions[sender]) return reply('Sesi renew berjalan. Ketik .batalkan');
                    const serverName = args[0]; if (!serverName) return reply(`Pilih server.\nContoh: .${command} sg`);
                    const serverConfig = await dbHelper.getVpnServer(serverName); if (!serverConfig) return reply(`Server [${serverName}] tidak ditemukan.`);
                    const price = await dbHelper.getVpnPrice(serverName, command, false, isPrem); if (price === 0) return reply(`Harga belum diatur.`);
                    vpnCreationSessions[sender] = { step: 'awaiting_username', vpnType: command, serverName: serverName, isStb: false };
                    await reply(`✅ Sesi VPN *[${serverName.toUpperCase()}] ${command.toUpperCase()}*.\nHarga: *Rp ${price.toLocaleString('id-ID')}*.\n\nBalas *username* (min 6).\nKetik .batalkan untuk batal.`);
                } break;
                // Perintah Beli STB
                case 'stbssh': case 'stbvmess': case 'stbvless': case 'stbtrojan': {
                    if (vpnCreationSessions[sender]) return reply('Sesi VPN berjalan. Ketik .batalkan');
                    if (renewSessions[sender]) return reply('Sesi renew berjalan. Ketik .batalkan');
                    const serverName = args[0]; if (!serverName) return reply(`Pilih server.\nContoh: .${command} sg`);
                    const serverConfig = await dbHelper.getVpnServer(serverName); if (!serverConfig) return reply(`Server [${serverName}] tidak ditemukan.`);
                    const vpnType = command.replace('stb', ''); const price = await dbHelper.getVpnPrice(serverName, vpnType, true, false); if (price === 0) return reply(`Harga belum diatur.`);
                    vpnCreationSessions[sender] = { step: 'awaiting_username', vpnType: vpnType, serverName: serverName, isStb: true };
                    await reply(`✅ Sesi VPN *[${serverName.toUpperCase()}] STB ${vpnType.toUpperCase()}*.\nHarga: *Rp ${price.toLocaleString('id-ID')}*.\n\nBalas *username* (min 6).\nKetik .batalkan untuk batal.`);
                } break;
                // Perintah .batalvpn dihapus, digabung ke .batalkan
                
                // Perintah Trial (Output Diperbarui)
                case 'trialssh': case 'trialvmess': case 'trialvless': case 'trialtrojan': {
                    const limit = isPrem ? 10 : 4; if (user.trialVpnCount >= limit) return reply(`Batas trial habis (${user.trialVpnCount}/${limit}).`);
                    const serverName = args[0]; if (!serverName) return reply(`Pilih server.\nContoh: .${command} sg`);
                    const serverConfig = await dbHelper.getVpnServer(serverName); if (!serverConfig) return reply(`Server [${serverName}] tidak ditemukan.`);
                    const vpnType = command.replace('trial', '');
                    await reply(`Membuat trial *[${serverName.toUpperCase()}] ${vpnType.toUpperCase()}*...`);
                    
                    // --- AWAL BLOK PENGGANTI ---
                    try {
                        const VPN_API_BASE_URL = serverConfig.api_url; 
                        const VPN_API_TOKEN = serverConfig.api_token;
                        let endpoint = `/trial${vpnType}all`; 
                        if (vpnType === 'ssh') endpoint = '/trialsshvpn';
                        
                        const response = await axios.post(VPN_API_BASE_URL + endpoint, { timelimit: "60m" }, { 
                            headers: { 'accept': 'application/json', 'Authorization': VPN_API_TOKEN, 'Content-Type': 'application/json' } 
                        });
                        
                        await dbHelper.incrementTrialCount(sender); 
                        const vpnData = response.data.data;

                        // --- Pembuatan Teks Output Dinamis ---
                        let resultText = `✅ *TRIAL VPN [${serverName.toUpperCase()}] ${vpnType.toUpperCase()} OK!*\n\n`;
                        resultText += `\`\`\`Informasi Akun\`\`\`\n`;
                        resultText += `• Server: ${vpnData.hostname}\n`;
                        resultText += `• User: ${vpnData.username}\n`;
                        resultText += `• Pass: ${vpnData.password || '-'}\n`; // Fallback
                        if (vpnData.uuid) resultText += `• UUID: ${vpnData.uuid}\n`;
                        resultText += `• Exp: ${vpnData.exp || vpnData.expired} (${vpnData.time || '1 Jam'})\n\n`;

                        resultText += `\`\`\`Informasi Server\`\`\`\n`;
                        resultText += `• Lokasi: ${vpnData.CITY}, ${vpnData.ISP}\n`;

                        // Port (Dynamic)
                        if (vpnData.port) {
                            resultText += `\n\`\`\`Informasi Port\`\`\`\n`;
                            if(vpnData.port.tls) resultText += `• SSL/TLS: ${vpnData.port.tls}\n`;
                            if(vpnData.port.none) resultText += `• Non-TLS: ${vpnData.port.none}\n`;
                            if(vpnData.port.any) resultText += `• Any: ${vpnData.port.any}\n`;
                            
                            // Port Khusus SSH
                            if(vpnType === 'ssh') {
                                if(vpnData.port.ovpntcp) resultText += `• OVPN TCP: ${vpnData.port.ovpntcp}\n`;
                                if(vpnData.port.ovpnudp) resultText += `• OVPN UDP: ${vpnData.port.ovpnudp}\n`;
                                if(vpnData.port.slowdns) resultText += `• SlowDNS: ${vpnData.port.slowdns}\n`;
                                if(vpnData.port.sshohp) resultText += `• SSH OHP: ${vpnData.port.sshohp}\n`;
                                if(vpnData.port.ovpnohp) resultText += `• OVPN OHP: ${vpnData.port.ovpnohp}\n`;
                                if(vpnData.port.squid) resultText += `• Squid: ${vpnData.port.squid}\n`;
                                if(vpnData.port.udpcustom) resultText += `• UDP Custom: ${vpnData.port.udpcustom}\n`;
                                if(vpnData.port.udpgw) resultText += `• UDP GW: ${vpnData.port.udpgw}\n`;
                            }

                            // Port Khusus Vmess/Vless/Trojan
                            if(vpnData.port.ws_tls && vpnType !== 'ssh') resultText += `• WS TLS: ${vpnData.port.ws_tls}\n`;
                            if(vpnData.port.ws_none && vpnType !== 'ssh') resultText += `• WS Non-TLS: ${vpnData.port.ws_none}\n`;
                            if(vpnData.port.grpc && vpnType !== 'ssh') resultText += `• GRPC: ${vpnData.port.grpc}\n`;
                        }

                        // Path (Vmess/Vless/Trojan)
                        if (vpnData.path) {
                            resultText += `\n\`\`\`Informasi Path\`\`\`\n`;
                            if(vpnData.path.stn) resultText += `• Standar: ${vpnData.path.stn}\n`;
                            if(vpnData.path.multi) resultText += `• Multi: ${vpnData.path.multi}\n`;
                            if(vpnData.path.grpc) resultText += `• GRPC: ${vpnData.path.grpc}\n`;
                            if(vpnData.path.up) resultText += `• Upgrade: ${vpnData.path.up}\n`;
                        }

                        // Payload (SSH)
                        if (vpnData.payloadws) {
                            resultText += `\n\`\`\`Payload WS (CDN)\`\`\`\n`;
                            resultText += `\`\`\`${vpnData.payloadws.payloadcdn}\`\`\`\n`;
                            resultText += `\n\`\`\`Payload WS (Path)\`\`\`\n`;
                            resultText += `\`\`\`${vpnData.payloadws.payloadwithpath}\`\`\`\n`;
                        }

                        // Link Akun (Vmess/Vless/Trojan)
                        if (vpnData.link && vpnType !== 'ssh') {
                            resultText += `\n\`\`\`Link Akun (Klik untuk Salin)\`\`\`\n`;
                            if(vpnData.link.tls) resultText += `• TLS:\n\`\`\`${vpnData.link.tls}\`\`\`\n`;
                            if(vpnData.link.none) resultText += `• Non-TLS:\n\`\`\`${vpnData.link.none}\`\`\`\n`;
                            if(vpnData.link.grpc) resultText += `• GRPC:\n\`\`\`${vpnData.link.grpc}\`\`\`\n`;
                            if(vpnData.link.uptls) resultText += `• Upgrade TLS:\n\`\`\`${vpnData.link.uptls}\`\`\`\n`;
                            if(vpnData.link.upntls) resultText += `• Upgrade Non-TLS:\n\`\`\`${vpnData.link.upntls}\`\`\`\n`;
                        }
                        // --- Akhir Pembuatan Teks Output ---

                        resultText += `\nSisa trial: *${limit - (user.trialVpnCount)}* kali.`; // trialVpnCount sudah di-increment
                        await reply(resultText.trim());
                    } catch (error) { 
                        reply(`Gagal trial [${serverName}].\nAlasan: ${error.response?.data?.meta?.message || error.message}`); 
                    }
                    // --- AKHIR BLOK PENGGANTI ---
                } break;

                // --- BARU: Fitur Renew VPN ---
                case 'renew':
                case 'perpanjang': {
                    if (global.renewSessions[sender]) return reply('Sesi perpanjangan sudah berjalan. Ketik .batalkan untuk batal.');
                    if (global.vpnCreationSessions[sender]) return reply('Sesi pembuatan VPN sedang berjalan. Selesaikan atau batalkan dulu.');
                    
                    const [vpnType, serverName] = args;
                    if (!vpnType || !serverName) return reply('Format salah.\nContoh: .renew [tipe] [server]\nContoh: .renew ssh sg');
                    
                    const validTypes = ['ssh', 'vmess', 'vless', 'trojan'];
                    if (!validTypes.includes(vpnType.toLowerCase())) return reply('Tipe VPN tidak valid (ssh, vmess, vless, trojan).');
                    
                    const server = await dbHelper.getVpnServer(serverName);
                    if (!server) return reply(`Server [${serverName}] tidak ditemukan.`);

                    global.renewSessions[sender] = {
                        step: 'awaiting_username',
                        vpnType: vpnType.toLowerCase(),
                        serverName: serverName.toLowerCase(),
                        serverConfig: server
                    };
                    
                    await reply(`✅ Sesi Perpanjangan *${vpnType.toUpperCase()} [${serverName.toUpperCase()}]*.\n\nBalas dengan *username* akun yang ingin diperpanjang.\nKetik .batalkan untuk batal.`);
                }
                break;

                case 'renewduration': { // Ini adalah command internal yang dipicu tombol
                    const session = global.renewSessions[sender];
                    // Cek sesi
                    if (!session || session.step !== 'awaiting_duration') {
                        // Sesi tidak valid atau sudah selesai, abaikan saja.
                        console.log("Sesi renewduration tidak valid atau sudah selesai.");
                        return; 
                    }

                    const duration = parseInt(args[0]);
                    const price = session.prices[duration];
                    
                    if (isNaN(duration) || !price) {
                        delete global.renewSessions[sender];
                        return reply('Pilihan durasi tidak valid. Sesi dibatalkan.');
                    }
                    
                    if (user.balance < price) {
                        delete global.renewSessions[sender];
                        return reply(`Saldo kurang! Butuh Rp ${price.toLocaleString('id-ID')}. Sesi dibatalkan.`);
                    }

                    await reply(`Memproses perpanjangan ${duration} hari seharga Rp ${price.toLocaleString('id-ID')}...`);
                    
                    // Potong saldo
                    await dbHelper.updateBalance(sender, -price);
                    const updatedUser = await dbHelper.getUser(sender);

                    try {
                        const { vpnType, username, serverConfig } = session;
                        const VPN_API_BASE_URL = serverConfig.api_url;
                        const VPN_API_TOKEN = serverConfig.api_token;
                        
                        // Tentukan endpoint renew
                        let endpoint = '';
                        if (vpnType === 'ssh') endpoint = `/renewsshvpn/${username}/${duration}`;
                        else if (vpnType === 'vmess') endpoint = `/renewvmess/${username}/${duration}`;
                        else if (vpnType === 'vless') endpoint = `/renewvless/${username}/${duration}`;
                        else if (vpnType === 'trojan') endpoint = `/renewtrojan/${username}/${duration}`;
                        
                        // API ini menggunakan metode PATCH dan butuh body { "kuota": 0 }
                        const response = await axios.patch(VPN_API_BASE_URL + endpoint, 
                            { kuota: 0 }, // Body sesuai permintaan API Anda
                            { 
                                headers: { 'accept': 'application/json', 'Authorization': VPN_API_TOKEN, 'Content-Type': 'application/json' } 
                            }
                        );
                        
                        const renewData = response.data.data;
                        const productName = `RENEW ${vpnType.toUpperCase()} ${duration}hr [${session.serverName.toUpperCase()}]`;
                        await dbHelper.logTransaction(sender, 'VPN_RENEW', productName, price);

                        let resultText = `✅ *Perpanjangan Berhasil!*\n\n`;
                        resultText += `• User: ${renewData.username}\n`;
                        resultText += `• Dari: ${renewData.from}\n`;
                        resultText += `• Ke: ${renewData.to}\n`;
                        resultText += `• Kuota: ${renewData.quota}\n\n`;
                        resultText += `💰 Harga: Rp ${price.toLocaleString('id-ID')}\n`;
                        resultText += `💳 Saldo: Rp ${updatedUser.balance.toLocaleString('id-ID')}`;
                        
                        await reply(resultText);

                    } catch (error) {
                        await dbHelper.updateBalance(sender, price); // Kembalikan saldo jika gagal
                        console.error("VPN Renew Err:", error.response?.data || error.message);
                        reply(`Gagal perpanjang. Saldo kembali.\nAlasan: ${error.response?.data?.meta?.message || error.message}`);
                    } finally {
                        delete global.renewSessions[sender];
                    }
                }
                break;
                // --- AKHIR BLOK RENEW ---


                 // --- BARU: Fitur Referral Grup ---
                case 'referral':
                case 'ref': {
                    if (!isGroup) return reply('Fitur ini hanya bisa digunakan di dalam grup.');
                    const referralCode = `REF-${jid.split('@')[0].substring(0, 4)}-${Date.now().toString().slice(-5)}`;
                    global.activeReferralCodes[referralCode] = { referrerJid: sender, groupId: jid };
                    const refMessage = `🎉 *Ajak Teman & Dapatkan Bonus!* 🎉\n\nBagikan kode ini:\n\`${referralCode}\`\n\nJika temanmu join grup *INI* & ketik *.joinref ${referralCode}* , kamu dapat bonus Rp ${referralBonus.toLocaleString('id-ID')}!`;
                    await reply(refMessage);
                } break;
                case 'joinref': {
                    if (!isGroup) return reply('Gunakan di grup tempat kamu diundang.');
                    const referralCode = args[0]; if (!referralCode) return reply('Format: .joinref [kode]');
                    const referralData = global.activeReferralCodes[referralCode];
                    if (!referralData || referralData.groupId !== jid) return reply('Kode referral tidak valid/bukan untuk grup ini.');
                    const existingReferral = await dbHelper.getReferralByReferred(sender); if (existingReferral) return reply('Anda sudah pernah pakai kode referral.');
                    if (referralData.referrerJid === sender) return reply('Tidak bisa pakai kode sendiri.');
                    try {
                        await dbHelper.addReferral(referralData.referrerJid, sender, jid);
                        await dbHelper.updateBalance(referralData.referrerJid, referralBonus);
                        await sock.sendMessage(referralData.referrerJid, { text: `🎉 @${sender.split('@')[0]} join via ref Anda! Bonus Rp ${referralBonus.toLocaleString('id-ID')} ditambahkan!`, mentions: [sender] });
                        await reply(`✅ Berhasil join ref dari @${referralData.referrerJid.split('@')[0]}!`, { mentions: [referralData.referrerJid] });
                        delete global.activeReferralCodes[referralCode]; // Kode hangus
                    } catch(e) { console.error("Referral Gagal:", e); reply("Gagal proses referral."); }
                } break;
                // ------------------------------------

                // --- BARU: Fitur Game ---
                case 'tebakkata': {
                    // if (!isGroup) return reply('Game hanya di grup.'); // Sudah dicek scope
                    if (global.gameSessions[jid]) return reply(`Masih ada game ${global.gameSessions[jid].type} berlangsung di grup ini!`);

                    const gameData = tebakKataData[Math.floor(Math.random() * tebakKataData.length)];
                    global.gameSessions[jid] = {
                        type: 'tebakkata',
                        data: {
                             kata: gameData.kata.toLowerCase(),
                             clue: gameData.clue,
                             attemptsLeft: 5, // Jumlah kesempatan
                             startTime: Date.now(),
                             participants: [sender] // Pemain pertama
                        },
                        starter: sender // Peny स्टार्ट game
                    };
                    await reply(`🎲 *Game Tebak Kata Dimulai!* 🎲\n\nClue: *${gameData.clue}*\n\nKamu punya 5 kesempatan untuk menebak kata.\nKetik jawabanmu langsung (tanpa prefix).\n\nKetik *.nyerah* untuk menyerah.`);
                } break;
                case 'nyerah': {
                    if (global.gameSessions[jid] && global.gameSessions[jid].type === 'tebakkata') {
                         const session = global.gameSessions[jid];
                         await reply(`Yah, menyerah 🏳️ Jawaban yang benar adalah *${session.data.kata}*.\n\nPartisipan: ${session.participants.map(p => `@${p.split('@')[0]}`).join(', ')}`, { mentions: session.participants });
                         delete global.gameSessions[jid];
                    } else {
                         reply('Tidak ada game Tebak Kata yang sedang berlangsung.');
                    }
                } break;
                case 'trivia': {
                     // if (!isGroup) return reply('Game hanya di grup.');
                     if (global.gameSessions[jid]) return reply(`Masih ada game ${global.gameSessions[jid].type} berlangsung!`);

                     const gameData = triviaData[Math.floor(Math.random() * triviaData.length)];
                     const timeoutDuration = 30000; // 30 detik

                     const timeout = setTimeout(async () => {
                          if (global.gameSessions[jid] && global.gameSessions[jid].type === 'trivia') {
                              await reply(`⏰ Waktu habis! Jawaban yang benar adalah *${gameData.a}*.\n\nPartisipan: ${global.gameSessions[jid].participants.map(p => `@${p.split('@')[0]}`).join(', ')}`, { mentions: global.gameSessions[jid].participants });
                              delete global.gameSessions[jid];
                          }
                     }, timeoutDuration);

                     global.gameSessions[jid] = {
                         type: 'trivia',
                         data: {
                              question: gameData.q,
                              answer: gameData.a.toLowerCase(),
                              options: gameData.o, // Bisa undefined
                              timeout: timeout,
                              startTime: Date.now()
                         },
                         starter: sender,
                         participants: [sender]
                     };

                     let triviaText = `🧠 *Trivia Time!* 🧠\n\n${gameData.q}\n\n`;
                     if (gameData.o) {
                          gameData.o.forEach((opt, index) => {
                               triviaText += `${index + 1}. ${opt}\n`;
                          });
                          triviaText += `\nKetik jawabanmu (teks atau nomor) dalam ${timeoutDuration / 1000} detik!`;
                     } else {
                          triviaText += `Ketik jawabanmu dalam ${timeoutDuration / 1000} detik!`;
                     }
                     triviaText += `\n\nKetik *.skip* (hanya starter) untuk ganti soal.`;
                     await reply(triviaText);
                } break;
                case 'skip': {
                     if (global.gameSessions[jid] && global.gameSessions[jid].type === 'trivia') {
                          const session = global.gameSessions[jid];
                          // Hanya starter yang bisa skip
                          if (sender === session.starter) {
                              clearTimeout(session.data.timeout);
                              await reply(`Soal trivia di-skip oleh @${sender.split('@')[0]}. Jawaban: *${session.data.answer}*`, { mentions: [sender] });
                              delete global.gameSessions[jid];
                          } else {
                              reply('Hanya yang memulai trivia yang bisa skip soal.');
                          }
                     } else {
                          reply('Tidak ada game Trivia yang sedang berlangsung.');
                     }
                } break;
                case 'suit': {
                    // if (!isGroup) return reply('Game hanya di grup.');
                    if (global.gameSessions[jid]) return reply(`Masih ada game ${global.gameSessions[jid].type} berlangsung!`);

                    let targetJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                    let player1 = sender;
                    let player2 = null;

                    if (targetJid) { // Mode Player vs Player
                        if (targetJid === sender) return reply('Tidak bisa suit dengan diri sendiri.');
                        if (targetJid === sock.user.id.replace(/:.*@/,'@')) return reply('Tidak bisa menantang bot, gunakan `.suit` saja.'); // Cek jika menantang bot
                        player2 = targetJid;
                    } else { // Mode Player vs Bot
                        player2 = sock.user.id.replace(/:.*@/,'@s.whatsapp.net'); // JID Bot
                    }

                    const timeoutDuration = 30000; // 30 detik
                     const timeout = setTimeout(async () => {
                         if (global.gameSessions[jid]?.type === 'suit') {
                              const sessionData = global.gameSessions[jid].data;
                              let timeoutMsg = `⏰ Waktu habis untuk suit antara @${sessionData.player1.split('@')[0]} dan `;
                              timeoutMsg += sessionData.player2.includes('@s.whatsapp.net') ? `@${sessionData.player2.split('@')[0]}` : 'Bot';
                              
                              if(!sessionData.choice1 && !sessionData.choice2) timeoutMsg += `\nTidak ada yang memilih.`;
                              else if (!sessionData.choice1) timeoutMsg += `\n@${sessionData.player1.split('@')[0]} tidak memilih.`;
                              else if (!sessionData.choice2 && !sessionData.player2.includes('@s.whatsapp.net')) timeoutMsg += `\n@${sessionData.player2.split('@')[0]} tidak memilih.`; // Bot tidak perlu nunggu
                              
                              await reply(timeoutMsg, { mentions: [sessionData.player1, sessionData.player2] });
                              delete global.gameSessions[jid];
                         }
                     }, timeoutDuration);

                    global.gameSessions[jid] = {
                        type: 'suit',
                        data: {
                            player1: player1,
                            player2: player2, // Bisa JID user atau JID bot
                            choice1: null,
                            choice2: null,
                            timeout: timeout
                        },
                        starter: sender
                    };

                    let opponentName = 'Bot';
                    let mentions = [player1];
                    if (!player2.includes('@s.whatsapp.net')) { // Jika player vs player
                         opponentName = `@${player2.split('@')[0]}`;
                         mentions.push(player2);
                    }

                    let suitMsg = `💥 *Game Suit Dimulai!* 💥\n\n@${player1.split('@')[0]} vs ${opponentName}\n\nSilakan pilih:\n• Batu 🗿\n• Gunting ✂️\n• Kertas 📄\n\nKirim pilihanmu di chat ini (tanpa prefix) dalam ${timeoutDuration / 1000} detik!`;

                    await reply(suitMsg, { mentions: mentions });

                    // Jika vs Bot, bot langsung memilih secara acak
                    if (player2.includes('@s.whatsapp.net')) {
                        const botChoices = ['batu', 'gunting', 'kertas'];
                        global.gameSessions[jid].data.choice2 = botChoices[Math.floor(Math.random() * botChoices.length)];
                        console.log(`Suit: Bot memilih ${global.gameSessions[jid].data.choice2}`);
                    }

                } break;

                // --- BARU: Perintah Batal Universal ---
                case 'batalkan': {
                    let sessionDibatalkan = false;

                    if (global.selectionSessions[sender]) {
                        delete global.selectionSessions[sender];
                        reply('✅ Sesi (selection) dibatalkan.');
                        sessionDibatalkan = true;
                    }
                    
                    if (global.resellerPurchaseSessions[sender]) {
                        delete global.resellerPurchaseSessions[sender];
                        reply('✅ Pembelian reseller dibatalkan.');
                        sessionDibatalkan = true;
                    }
                    
                    if (global.otpSessions[sender]) {
                        delete global.otpSessions[sender];
                        reply('✅ Sesi verifikasi OTP dibatalkan.');
                        sessionDibatalkan = true;
                    }
                    
                    if (global.vpnCreationSessions[sender]) {
                        delete global.vpnCreationSessions[sender];
                        reply('✅ Sesi pembuatan VPN dibatalkan.');
                        sessionDibatalkan = true;
                    }

                    if (global.renewSessions[sender]) {
                        delete global.renewSessions[sender];
                        reply('✅ Sesi perpanjangan VPN dibatalkan.');
                        sessionDibatalkan = true;
                    }
                    
                    if (global.unregSessions[sender]) {
                         delete global.unregSessions[sender];
                         reply('✅ Sesi unreg dibatalkan.');
                         sessionDibatalkan = true;
                    }

                    if (!sessionDibatalkan) {
                        reply('Tidak ada sesi aktif yang untuk dibatalkan.');
                    }
                }
                break;
                // --- AKHIR BLOK BATAL ---


                // --- DEFAULT CASE ---
                default:
                    if (body.startsWith(prefix)) {
                        reply(`Perintah *${command}* tidak ditemukan. Ketik *.menu*`);
                    }
            }

        } catch (err) {
            console.error("Error Utama:", err);
            try {
                if (OWNER_NUMBERS.length > 0) {
                    let commandText = body || "[No Body]";
                    let senderText = sender || "[No Sender]";
                    await sock.sendMessage(OWNER_NUMBERS[0] + '@s.whatsapp.net', { text: `[CRASH REPORT]\nUser: ${pushName} (${senderText})\nCmd: ${commandText}\nErr: ${util.format(err)}` });
                }
            } catch (e) { console.error("Gagal lapor crash:", e); }
        }
    });
}

// --- 8. JALANKAN BOT ---
connectToWhatsApp();

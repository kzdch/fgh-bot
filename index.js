require('dotenv').config(); // .env から環境変数を読み込む

const { Client, GatewayIntentBits } = require("discord.js");
const { chromium } = require("playwright");

// 環境変数から取得
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const SERVER_URL = process.env.SERVER_URL; // Render環境ではURLも.envに
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

// Discord Bot設定
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log("✅ Bot is online");
});

let monitoring = false;

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!start") {
    await message.reply("🟢 Terraria サーバーを起動します…");

    const browser = await chromium.launch({
    headless: true,       // GUI が無いので必ず true
    args: ['--no-sandbox'] // Render 上で必要
});

    const page = await browser.newPage();

    try {
      // ログイン
      await page.goto("https://panel.freegamehost.xyz/auth/login");
      await page.waitForTimeout(2000);
      await page.fill('input[name="username"]', EMAIL);
      await page.fill('input[name="password"]', PASSWORD);
      await page.click('button[type="submit"]');

      // ダッシュボード待機
      await page.waitForTimeout(5000);

      // サーバーページへ
      await page.goto(SERVER_URL);
      await page.waitForTimeout(3000);

      // Startボタンを取得
      const startBtn = await page.waitForSelector('button:has-text("Start")', { timeout: 15000 });

      // 起動可能なら押す
      const disabled = await startBtn.getAttribute("disabled");
      if (disabled === null) {
        await startBtn.click();
        await message.reply("🚀 Terraria サーバーを起動しました！");
      } else {
        await message.reply("⚠ Startボタンが無効です。既に起動中かもしれません。");
      }

      // --- サーバー監視開始（誤通知防止） ---
      if (!monitoring) {
        monitoring = true;
        setTimeout(() => {
          checkServerStatus(page, message);
        }, 7000); // 起動直後の誤通知防止
      }

    } catch (err) {
      console.error(err);
      await message.reply("❌ サーバー起動に失敗しました。コンソールを確認してください。");
    }
  }
});

// サーバー状態監視関数
async function checkServerStatus(page, message) {
  let notified = false;

  while (true) {
    try {
      const startBtn = await page.$('button:has-text("Start")');
      if (startBtn) {
        const disabled = await startBtn.getAttribute("disabled");
        if (disabled === null) {
          // ボタン有効＝サーバー停止中
          if (!notified) {
            await message.reply("⚠ サーバーが停止しています！");
            notified = true;
          }
        } else {
          notified = false; // サーバー起動中
        }
      }
    } catch (err) {
      console.error("監視エラー:", err);
    }
    await page.waitForTimeout(10000); // 10秒ごとに監視
  }
}

// Bot起動
client.login(DISCORD_TOKEN);

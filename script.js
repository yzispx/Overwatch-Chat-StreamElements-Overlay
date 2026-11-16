/* =========================================================
   1. CHAT SETTINGS
========================================================= */

const log = document.getElementById("log");

let CONFIG = {
    maxMessages: 30,
    hideCommands: false,
    textSize: 20,
    badgeSize: 18,
    emoteSize: 28,

    // Regular User Settings
    usernameColor: "#E79968",
    messageColor: "#E79968",
    useTwitchColor: false,
    usernameBold: true,
    showBadges: true,
    usernameColorBadges: true,
    userPingIcon: true,

    // System User Settings
    sysUsers: ["streamelements", "nightbot"],
    sysUserColor: "#E4E325",
    sysShowBadges: false,
    sysShowUsername: true,
    sysUserIcon: true
};

/* =========================================================
   7TV EMOTES LOADER
========================================================= */

const sevenTVEmotes = {};

async function load7TV(channelName, twitchId) {
    try {
        const globalRes = await fetch("https://api.7tv.app/v3/emote-sets/global");
        const globalData = await globalRes.json();
        globalData.emotes?.forEach(e => {
            sevenTVEmotes[e.name] = `https://cdn.7tv.app/emote/${e.id}/2x.webp`;
        });

        if (!twitchId && channelName) {
            const seRes = await fetch(`https://api.streamelements.com/kappa/v2/channels/${channelName}`);
            const seData = await seRes.json();
            twitchId = seData.providerId;
        }

        if (twitchId) {
            const userRes = await fetch(`https://api.7tv.app/v3/users/twitch/${twitchId}`);
            const userData = await userRes.json();
            userData.emote_set?.emotes?.forEach(e => {
                sevenTVEmotes[e.name] = `https://cdn.7tv.app/emote/${e.id}/2x.webp`;
            });
        }
    } catch (err) {
        console.error("7TV load error:", err);
    }
}

function parseUserList(text) {
    return String(text || "")
        .split(",")
        .map(user => user.trim().toLowerCase())
        .filter(Boolean);
}

window.addEventListener("onWidgetLoad", (obj) => {
    const channelName = obj.detail?.channel?.username;
    load7TV(channelName);

    const fields = obj.detail.fieldData;
    if (!fields) return;

    CONFIG.maxMessages = Number(fields.maxMessages) || CONFIG.maxMessages;
    CONFIG.hideCommands = fields.hideCommands ?? CONFIG.hideCommands;
    CONFIG.textSize = Number(fields.textSize) || CONFIG.textSize;
    CONFIG.badgeSize = Number(fields.badgeSize) || CONFIG.badgeSize;
    CONFIG.emoteSize = Number(fields.emoteSize) || CONFIG.emoteSize;

    // Regular User Settings
    CONFIG.usernameColor = fields.usernameColor || CONFIG.usernameColor;
    CONFIG.messageColor = fields.messageColor || CONFIG.messageColor;
    CONFIG.useTwitchColor = fields.useTwitchColor ?? CONFIG.useTwitchColor;
    CONFIG.usernameBold = fields.usernameBold ?? CONFIG.usernameBold;
    CONFIG.showBadges = fields.showBadges ?? CONFIG.showBadges;
    CONFIG.usernameColorBadges = fields.usernameColorBadges ?? CONFIG.usernameColorBadges;
    CONFIG.userPingIcon = fields.userPingIcon ?? CONFIG.userPingIcon;

    // System User Settings
    if (fields.sysUsers !== undefined) {
        CONFIG.sysUsers = parseUserList(fields.sysUsers);
    }
    CONFIG.sysUserColor = fields.sysUserColor || CONFIG.sysUserColor;
    CONFIG.sysShowBadges = fields.sysShowBadges ?? CONFIG.sysShowBadges;
    CONFIG.sysShowUsername = fields.sysShowUsername ?? CONFIG.sysShowUsername;
    CONFIG.sysUserIcon = fields.sysUserIcon ?? CONFIG.sysUserIcon;
});

/* =========================================================
   2. STREAM EVENTS
========================================================= */

window.addEventListener("onEventReceived", (obj) => {
    const listener = obj.detail.listener;
    const event = obj.detail.event;

    // Delete a single message
    if (listener === "delete-message") {
        log.querySelector(`[data-id="${event.msgId}"]`)?.remove();
        return;
    }

    // Delete all messages from a user
    if (listener === "delete-messages") {
        log.querySelectorAll(`[data-from="${event.userId}"]`)
            .forEach(msg => msg.remove());
        return;
    }

    // Ignore anything that isn't a chat message
    if (listener !== "message") return;

    const data = event.data;
    if (CONFIG.hideCommands && data.text.startsWith("!")) return;

    // Load channel 7TV emotes if not loaded yet (uses Twitch channel ID from message)
    if (data.tags?.["room-id"] && Object.keys(sevenTVEmotes).length <= 1) {
        load7TV(null, data.tags["room-id"]);
    }

    createMessage(data);
});

/* =========================================================
   3. CREATE CHAT MESSAGE
========================================================= */

function createMessage(data) {
    const row = document.createElement("div");
    row.className = "leading-snug transition-all duration-300 relative break-words animate-fadein";
    row.style.fontSize = `${CONFIG.textSize}px`;

    row.dataset.id = data.msgId;
    row.dataset.from = data.userId;

    // Check if the chatter is in the System Users list
    const isSysUser = CONFIG.sysUsers.includes(data.displayName.toLowerCase());

    // Pick colors & badge visibility based on user type
    const userColor = isSysUser
        ? CONFIG.sysUserColor
        : (CONFIG.useTwitchColor && data.displayColor ? data.displayColor : CONFIG.usernameColor);

    const textColor = isSysUser ? CONFIG.sysUserColor : CONFIG.messageColor;
    const showBadges = isSysUser ? CONFIG.sysShowBadges : CONFIG.showBadges;
    const showIcon = isSysUser ? CONFIG.sysUserIcon : CONFIG.userPingIcon;

    // Username
    const username = document.createElement("span");
    username.className = CONFIG.usernameBold ? "font-bold" : "";
    username.style.color = userColor;

    if (!isSysUser || CONFIG.sysShowUsername) {
        username.textContent = `[${data.displayName}]: `;
    }

    // Badges
    if (showBadges && data.badges) {
        for (const badge of data.badges) {
            const imgrow = document.createElement("span");
            imgrow.className = "inline-flex relative align-middle mr-1";
            imgrow.style.width = `${CONFIG.badgeSize}px`;
            imgrow.style.height = `${CONFIG.badgeSize}px`;

            const img = document.createElement("img");
            img.src = badge.url;
            img.className = "w-full h-full object-contain";

            // Single-color badge effect
            if (CONFIG.usernameColorBadges) {
                img.className = "absolute inset-0 w-full h-full grayscale mix-blend-multiply opacity-50";

                const imgbg = document.createElement("span");
                imgbg.className = "absolute inset-0";
                imgbg.style.backgroundColor = userColor;
                imgbg.style.mask = `url("${badge.url}") center / contain no-repeat`;
                imgbg.style.webkitMask = `url("${badge.url}") center / contain no-repeat`;

                imgrow.append(imgbg);
            }

            imgrow.append(img);
            username.prepend(imgrow);
        }
    }

    // Icon on the left
    if (showIcon) {
        const pingIcon = document.createElement("i");

        if (isSysUser) {
            pingIcon.setAttribute("data-lucide", "info");
            pingIcon.className = "inline-block size-4 mr-2 align-middle";
        } else {
            pingIcon.className = "inline-block size-2 mr-2 rounded-[2px] rotate-45 align-middle";
            pingIcon.style.backgroundColor = userColor;
        }

        username.prepend(pingIcon);

        if (isSysUser && window.lucide) {
            lucide.createIcons({ root: username });
            const svg = username.querySelector("svg");

            if (svg) {
                svg.style.fill = CONFIG.sysUserColor;
                svg.style.strokeWidth = "3";
                svg.style.stroke = "#0F1427";
            }
        }
    }

    // Message text
    const content = document.createElement("span");
    content.style.color = textColor;
    content.append(renderEmotes(data));

    // Add to chat log
    row.append(username, content);
    log.append(row);

    // Remove oldest message when over maxMessages
    while (log.children.length > CONFIG.maxMessages) {
        log.firstElementChild.remove();
    }

    // Autoscroll
    log.scrollTop = log.scrollHeight;
    row.scrollIntoView({ block: "end" });
}

/* =========================================================
   4. RENDER TWITCH EMOTES
========================================================= */

function renderEmotes(data) {
    const fragment = document.createDocumentFragment();
    const words = (data.text || "").split(" ");
    const emotes = data.emotes || [];

    for (const word of words) {
        const seEmote = emotes.find(e => e.name === word);
        const emoteUrl = seEmote
            ? (seEmote.urls[4] || seEmote.urls[2] || seEmote.urls[1])
            : sevenTVEmotes[word];

        if (emoteUrl) {
            const img = document.createElement("img");
            img.src = emoteUrl;
            img.className = "inline-block align-middle mx-0.5";
            img.style.height = `${CONFIG.emoteSize}px`;
            fragment.append(img, " ");
        } else {
            // Just normal text
            fragment.append(word + " ");
        }
    }

    return fragment;
}

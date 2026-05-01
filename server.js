const express = require("express");
const fetch = require("node-fetch");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const PASSWORD = "key123";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = "yourgithubusername";
const REPO_NAME = "verification-system";
const FILE_PATH = "verified.json";

function generateToken() {
    return crypto.randomBytes(24).toString("hex");
}

function getUserIP(req) {
    return (
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket.remoteAddress ||
        "unknown"
    );
}

async function getGithubFile() {
    const res = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
        {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                Accept: "application/vnd.github.v3+json"
            }
        }
    );

    return await res.json();
}

async function updateGithubFile(data, sha) {
    const content = Buffer.from(
        JSON.stringify(data, null, 2)
    ).toString("base64");

    await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
        {
            method: "PUT",
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                Accept: "application/vnd.github.v3+json"
            },
            body: JSON.stringify({
                message: "Verification update",
                content,
                sha
            })
        }
    );
}

app.post("/verify", async (req, res) => {
    try {
        const { username, userid, time, password } = req.body;

        if (!username || !userid || !time || !password) {
            return res.status(400).json({
                success: false,
                message: "Missing data"
            });
        }

        if (password !== PASSWORD) {
            return res.status(403).json({
                success: false,
                message: "Wrong password"
            });
        }

        const ip = getUserIP(req);
        const token = generateToken();

        const fileData = await getGithubFile();

        let current = [];

        if (fileData.content) {
            current = JSON.parse(
                Buffer.from(fileData.content, "base64").toString()
            );
        }

        let existing = current.find(
            x => x.userid == userid || x.ip == ip
        );

        if (!existing) {
            const newUser = {
                username,
                userid,
                ip,
                token,
                time
            };

            current.push(newUser);

            await updateGithubFile(current, fileData.sha);

            return res.json({
                success: true,
                token,
                message: "Verified"
            });
        }

        return res.json({
            success: true,
            token: existing.token,
            message: "Already verified"
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

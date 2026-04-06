import express from "express";
import { createServer } from "http";
import { initPostgres, pool } from "./postgres.js";
import cors from "cors";
import { Server } from "socket.io";
import admin from "./firebase.js";

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send("No token");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error(err);
    res.status(401).send("Invalid token");
  }
};

const app = express();
const port = 3000;

await initPostgres();

app.use(cors());
app.use(express.json());
app.use(verifyFirebaseToken);

app.post("/user", async (req, res) => {
  const { email } = req.user;

  const { rows } = await pool.query(`SELECT * FROM accounts WHERE email = $1`, [
    email,
  ]);

  if (rows.length) {
    return;
  }

  const { rows: created } = await pool.query(
    `INSERT INTO accounts (email)
     VALUES ($1)
     RETURNING *`,
    [email],
  );

  res.send();
});

app.get("/user", async (req, res) => {
  const { email } = req.user;

  const { rows } = await pool.query(`SELECT * FROM accounts WHERE email = $1`, [
    email,
  ]);

  res.send(rows[0]);
});

app.post("/playgrounds", async function (req, res) {
  const { name, description, creator_id, host_id } = req.body;

  await pool.query("BEGIN");

  const result = await pool.query(
    `INSERT INTO public.playgrounds (name, description, creator_id, host_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id`,
    [name, description, creator_id, host_id],
  );

  const playgroundId = result.rows[0].id;

  await pool.query(
    `INSERT INTO playground_players (playground_id, account_id)
     VALUES ($1, $2)`,
    [playgroundId, host_id],
  );

  await pool.query("COMMIT");

  res.send("Playground created!");
});

app.get("/playgrounds", async function (req, res) {
  const { rows } = await pool.query(`
    SELECT 
      p.id,
      p.name,
      p.description,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', a.id,
          'name', a.name
        )
      ) as players
    FROM playgrounds p
    LEFT JOIN playground_players pp ON pp.playground_id = p.id
    LEFT JOIN accounts a ON a.id = pp.account_id
    GROUP BY p.id
  `);

  res.send(rows);
});

app.post("/join", async function (req, res) {
  const { playground_id, account_id, joined_at } = req.body;

  await pool.query("BEGIN");

  await pool.query(
    `INSERT INTO public.playground_players (playground_id, account_id, joined_at)
    VALUES ($1, $2, $3)`,
    [playground_id, account_id, joined_at],
  );

  const { rows } = await pool.query(`
    SELECT 
      p.id,
      p.name,
      p.description,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', a.id,   
          'name', a.name
        )
      ) as players
    FROM playgrounds p
    LEFT JOIN playground_players pp ON pp.playground_id = p.id
    LEFT JOIN accounts a ON a.id = pp.account_id
    GROUP BY p.id
  `);

  io.emit("playgrounds:updated", rows);

  await pool.query("COMMIT");
});

app.post("/leave", async function (req, res) {
  const { playground_id, account_id } = req.body;

  await pool.query("BEGIN");

  await pool.query(
    `DELETE FROM public.playground_players WHERE account_id = ${account_id} AND playground_id = ${playground_id}`,
  );

  const { rows } = await pool.query(`
    SELECT 
      p.id,
      p.name,
      p.description,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', a.id,
          'name', a.name
        )
      ) as players
    FROM playgrounds p
    LEFT JOIN playground_players pp ON pp.playground_id = p.id
    LEFT JOIN accounts a ON a.id = pp.account_id
    GROUP BY p.id
  `);

  io.emit("playgrounds:updated", rows);

  await pool.query("COMMIT");
});

const httpServer = app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    credentials: false,
  },
});

io.on("connection", (socket) => {
  console.log("a user connected");
});

// "@vitest/eslint-plugin": "^1.5.0",
// "@vue/eslint-config-prettier": "^10.2.0",
// "@vue/eslint-config-typescript": "^14.6.0",
// "@vue/test-utils": "^2.4.6",
// "@vue/tsconfig": "^0.8.1",
// "eslint-plugin-playwright": "^2.3.0",
// "eslint-plugin-vue": "~10.5.1",

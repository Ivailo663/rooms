import express from "express";
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
    `INSERT INTO public.accounts (email)
     VALUES ($1)
     RETURNING *`,
    [email],
  );

  res.send();
});

app.get("/user", async (req, res) => {
  const { email } = req.user;

  const { rows } = await pool.query(
    `SELECT * FROM public.accounts WHERE email = $1`,
    [email],
  );

  res.send(rows[0]);
});

app.post("/rooms", async function (req, res) {
  const { name, description, creator_id, host_id } = req.body;

  await pool.query("BEGIN");

  const result = await pool.query(
    `INSERT INTO public.rooms (name, description, creator_id, host_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id`,
    [name, description, creator_id, host_id],
  );

  const roomId = result.rows[0].id;

  await pool.query(
    `INSERT INTO room_players (room_id, account_id)
     VALUES ($1, $2)`,
    [roomId, host_id],
  );

  await pool.query("COMMIT");

  res.send("room created!");
});

app.get("/rooms", async function (req, res) {
  const isHost = req.query.hosted === "true";
  const userId = Number(req.query.user_id);

  const operator = isHost ? "=" : "!=";

  const { rows } = await pool.query(
    `
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
    FROM rooms p
    LEFT JOIN room_players rp ON rp.room_id = p.id
    LEFT JOIN accounts a ON a.id = rp.account_id
    WHERE p.host_id ${operator} $1
    GROUP BY p.id
  `,
    [userId],
  );

  res.send(rows);
});

app.post("/join", async function (req, res) {
  const { room_id, account_id, joined_at } = req.body;

  await pool.query("BEGIN");

  await pool.query(
    `INSERT INTO public.room_players (room_id, account_id, joined_at)
    VALUES ($1, $2, $3)`,
    [room_id, account_id, joined_at],
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
    FROM rooms p
    LEFT JOIN room_players rp ON rp.room_id = p.id
    LEFT JOIN accounts a ON a.id = rp.account_id
    GROUP BY p.id
  `);

  io.emit("rooms:updated", rows);

  await pool.query("COMMIT");
});

app.post("/leave", async function (req, res) {
  const { room_id, account_id } = req.body;

  await pool.query("BEGIN");

  await pool.query(
    `DELETE FROM public.room_players WHERE account_id = ${account_id} AND room_id = ${room_id}`,
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
    FROM rooms p
    LEFT JOIN room_players rp ON rp.room_id = p.id
    LEFT JOIN accounts a ON a.id = rp.account_id
    GROUP BY p.id
  `);

  io.emit("rooms:updated", rows);

  await pool.query("COMMIT");
});

const httpServer = app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("a user connected");
});

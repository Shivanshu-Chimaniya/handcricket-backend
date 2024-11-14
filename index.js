const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const {Server} = require("socket.io");

const gameController = require("./controllers/game");
const mongoose = require("mongoose");

const io = new Server(server, {
	cors: {
		origin: "http://localhost:5173",
		methods: ["GET", "POST"],
	},
});

const PORT = 3000;
const cors = require("cors");
const {Game} = require("./models/Game");

mongoose
	.connect("mongodb://localhost:27017/handcricket")
	.then(async () => {
		let res = await Game.deleteMany({});
		console.log(
			`Connected to MongoDB, Deleted them ${res.deletedCount} games`
		);
	})
	.catch((err) => console.error("MongoDB connection error:", err));

// express
app.use(cors("*"));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Routes
app.post("/api/create", gameController.createGame);
app.post("/api/join", gameController.joinGame);
app.get("/api/game/:roomCode", gameController.getGame);

const games = {};

// Socket.io logic
io.on("connection", (socket) => {
	console.log(`User connected: ${socket.id}`);

	socket.on("createGame", async ({playerName}) => {
		const generateRoomCode = () =>
			Math.random().toString(36).substring(2, 8).toUpperCase();
		let roomCode = generateRoomCode();

		let dulpicate = await Game.find({roomCode});
		while (dulpicate.length !== 0) {
			roomCode = generateRoomCode();
			dulpicate = await Game.find({roomCode});
		}
		try {
			const game = new Game({
				roomCode,
				players: [{name: playerName, socketId: socket.id}],
				scores: [0, 0],
				currBall: [-1, -1],
			});
			await game.save();
			games[roomCode] = game;
			socket.join(roomCode);
			socket.emit("gameCreated", {game});
		} catch (err) {
			console.error(err);
		}
	});

	socket.on("joinGame", async ({roomCode, playerName}) => {
		const game = await Game.findOne({roomCode});
		if (game && game.players.length < 2) {
			game.players.push({name: playerName, socketId: socket.id});
			await game.save();
			socket.join(roomCode);
			games[roomCode] = game;
			// Emit to all players in the room that the player has joined
			io.to(roomCode).emit("playerJoined", {game});
		}
	});

	socket.on("startGame", async ({roomCode}) => {
		const game = await Game.findOne({roomCode});
		if (game && game.players.length == 2) {
			io.to(roomCode).emit("startGame");
		}
	});

	socket.on("playerTossMove", async ({roomCode, choice}) => {
		const game = await Game.findOne({roomCode});

		const p1 = game.players[0].socketId;
		const p2 = game.players[1].socketId;

		if (socket.id === p1) {
			if (game.p1tossChoice !== null) return;
			game.p1tossChoice = choice;
		} else if (socket.id === p2) {
			if (game.p2tossChoice !== null) return;
			game.p2tossChoice = choice;
		}

		if (game.p1tossChoice === null || game.p2tossChoice === null) {
			await game.save();
			return;
		}

		if (
			(game.p1tossChoice === "rocks" &&
				game.p2tossChoice === "scissors") ||
			(game.p1tossChoice === "paper" && game.p2tossChoice === "rocks") ||
			(game.p1tossChoice === "scissors" && game.p2tossChoice === "paper")
		) {
			game.battingTurn = 0;
			await game.save();
			io.to(roomCode).emit("tossWinner", {winnerId: p1});
		} else if (game.p1tossChoice === game.p2tossChoice) {
			game.p1tossChoice = null;
			game.p2tossChoice = null;
			await game.save();
			io.to(roomCode).emit("tossDraw");
		} else if (
			(game.p2tossChoice === "rocks" &&
				game.p1tossChoice === "scissors") ||
			(game.p2tossChoice === "paper" && game.p1tossChoice === "rocks") ||
			(game.p2tossChoice === "scissors" && game.p1tossChoice === "paper")
		) {
			game.battingTurn = 1;
			await game.save();
			io.to(roomCode).emit("tossWinner", {winnerId: p2});
		} else {
			console.log("what is rps?");
		}
		await game.save();
	});

	socket.on("playerMove", async ({roomCode, move}) => {
		const game = await Game.findOne({roomCode});

		const p1 = game.players[0].socketId;
		const p2 = game.players[1].socketId;

		if (socket.id == p1) {
			if (game.currBall[0] !== -1) return;
			game.currBall[0] = move;
		} else if (socket.id == p2) {
			if (game.currBall[1] !== -1) return;
			game.currBall[1] = move;
		}

		if (game.currBall[0] === -1 || game.currBall[1] === -1) {
			await game.save();
			return;
		}

		if (game.currBall[0] === game.currBall[1]) {
			//out
			game.targetScore = game.scores[game.battingTurn];
			game.battingTurn = game.battingTurn === 0 ? 1 : 0;
			if (game.isFirstInnings) {
				io.to(roomCode).emit("out", {target: game.targetScore});
			} else {
				if (
					game.scores[game.battingTurn] ==
					game.scores[(game.battingTurn + 1) % 2]
				) {
					io.to(roomCode).emit("gameover", {result: "draw"});
				} else {
					io.to(roomCode).emit("gameover", {result: "allout"});
				}
			}
			game.isFirstInnings = false;
		} else {
			let runsScored = game.currBall[game.battingTurn];
			game.scores[game.battingTurn] += runsScored;
			if (game.isFirstInnings) {
				game.firstInning.push(runsScored);
				game.firstSpan++;
			} else {
				game.secondInning.push(runsScored);
				game.secondSpan++;
				if (
					game.scores[game.battingTurn] >
					game.scores[(game.battingTurn + 1) % 2]
				) {
					io.to(roomCode).emit("gameover", {result: "chased"});
				}
			}
		}
		let move1 = game.currBall[0];
		let move2 = game.currBall[1];
		game.currBall = [-1, -1];
		await game.save();
		io.to(roomCode).emit("updateGame", {game, move1, move2});
	});

	socket.on("disconnect", async () => {
		console.log(`User disconnected: ${socket.id}`);

		let games = await Game.find({});
		for (let game of games) {
			if (game.players[0].socketId === socket.id) {
				io.to(game.roomCode).emit("game_aborted");
				await Game.deleteOne({roomCode: game.roomCode});
			} else if (game.players[1].socketId === socket.id) {
				io.to(game.roomCode).emit("game_aborted");
				await Game.deleteOne({roomCode: game.roomCode});
			}
		}
	});
});

server.listen(3000, () => {
	console.log("listening on :3000");
});

if (process.env.NODE_ENV != "production") {
	require("dotenv").config();
}

const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const {Server} = require("socket.io");

const io = new Server(server, {
	cors: {
		origin: "*",
		methods: ["GET", "POST"],
	},
});
const PORT = process.env.PORT || 3000;
const cors = require("cors");

// const mongoose = require("mongoose");
// const {Game} = require("./models/game");
// let DB_URL = process.env.MONGOATLASURL;
// let DB_URL = "mongodb://localhost:27017/handcricket";
// mongoose
// 	.connect(DB_URL)
// 	.then(async () => {
// 		let res = await Game.deleteMany({});
// 		console.log(
// 			`Connected to MongoDB, Deleted them ${res.deletedCount} games`
// 		);
// 	})
// 	.catch((err) => console.error("MongoDB connection error:", err));
// const gameController = require("./controllers/game");

// express
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Routes
app.get("/", (req, res) => {
	res.json("connected");
});
app.get("/api/game/:roomCode", async (req, res) => {
	let roomCode = req.params.roomCode;
	const game = games[roomCode];
	if (game === undefined) {
		res.status(500).json({error: "no game"});
	}
	res.status(200).json(game);
});

const games = {};

const generateRoomCode = () => {
	const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let roomCode = "";
	for (let i = 0; i < 3; i++) {
		const randomIndex = Math.floor(Math.random() * letters.length);
		roomCode += letters[randomIndex];
	}
	return roomCode;
};

const generateNewGame = ({roomCode, socketId, playerName}) => {
	return {
		roomCode,
		leader: {playerName, socketId},
		players: [{playerName, socketId}],

		p1tossChoice: -1,
		p2tossChoice: -1,

		tossWinner: -1, //-1,  0 or 1
		battingTurn: -1, // -1,  0 or 1
		targetScore: -1,
		isFirstInnings: true,
		gameWinner: -1,
		hasSeenResults: -1,

		firstInning: [],
		secondInning: [],
		spans: [0, 0], // [0, 0]
		scores: [0, 0],
		currBall: [-1, -1], // [player1Score, player2Score]

		isGameActive: true,
	};
};

// Socket.io logic
io.on("connection", (socket) => {
	console.log(`${socket.id} connected!`);
	socket.on("create-new-game", async ({playerName}) => {
		let roomCode = generateRoomCode();

		while (games[roomCode] !== undefined) {
			console.log("duplicate room: ", roomCode);
			roomCode = generateRoomCode();
		}

		const game = generateNewGame({
			roomCode,
			socketId: socket.id,
			playerName,
		});
		games[roomCode] = game;
		socket.join(roomCode);
		socket.emit("GameCreated", {game});
	});

	socket.on("join-game", async ({roomCode, playerName}) => {
		const game = games[roomCode];
		if (!game) {
			socket.emit("NoGameFound");
			return;
		}
		if (game.players.length >= 2) {
			socket.emit("GameIsFull");
			return;
		}
		game.players.push({playerName, socketId: socket.id});
		socket.join(roomCode);
		io.to(roomCode).emit("PlayerJoined", {game});
	});

	socket.on("start-game", async ({roomCode}) => {
		const game = games[roomCode];
		if (game && game.players.length == 2) {
			io.to(roomCode).emit("StartTossing", {game});
		}
	});

	socket.on("has-seen-results", async ({roomCode}) => {
		const game = games[roomCode];
		if (game.leader.socketId === socket.id) {
			io.to(roomCode).emit("start-second-inning", {game});
		}
	});

	socket.on("player-toss-move", async ({roomCode, choice}) => {
		const game = games[roomCode];
		if (!game) return;
		const p1 = game.players[0].socketId;
		const p2 = game.players[1].socketId;

		if (socket.id === p1) {
			if (game.p1tossChoice !== -1) return;
			game.p1tossChoice = choice;
		} else if (socket.id === p2) {
			if (game.p2tossChoice !== -1) return;
			game.p2tossChoice = choice;
		}

		if (game.p1tossChoice === -1 || game.p2tossChoice === -1) {
			return;
		}
		if (
			(game.p1tossChoice === "rock" &&
				game.p2tossChoice === "scissors") ||
			(game.p1tossChoice === "paper" && game.p2tossChoice === "rock") ||
			(game.p1tossChoice === "scissors" && game.p2tossChoice === "paper")
		) {
			game.tossWinner = 0;
			io.to(roomCode).emit("TossWinner", {
				winner: game.players[0],
				p1choice: game.p1tossChoice,
				p2choice: game.p2tossChoice,
			});
		} else if (game.p1tossChoice === game.p2tossChoice) {
			let p1choice = game.p1tossChoice,
				p2choice = game.p2tossChoice;
			game.p1tossChoice = -1;
			game.p2tossChoice = -1;
			io.to(roomCode).emit("TossDraw", {
				winner: "Mika Singh",
				p1choice,
				p2choice,
			});
		} else if (
			(game.p2tossChoice === "rock" &&
				game.p1tossChoice === "scissors") ||
			(game.p2tossChoice === "paper" && game.p1tossChoice === "rock") ||
			(game.p2tossChoice === "scissors" && game.p1tossChoice === "paper")
		) {
			game.tossWinner = 1;
			io.to(roomCode).emit("TossWinner", {
				winner: game.players[1],
				p1choice: game.p1tossChoice,
				p2choice: game.p2tossChoice,
			});
		} else {
			console.log("what is rps?");
		}
	});

	socket.on("player-wants-to", async ({roomCode, choice}) => {
		const game = games[roomCode];
		if (game.battingTurn !== -1) return;
		if (socket.id !== game.players[game.tossWinner].socketId) return;

		let isBattingTurn0 =
			(game.tossWinner == 0 && choice) ||
			(game.tossWinner == 1 && !choice);
		game.battingTurn = isBattingTurn0 ? 0 : 1;
		io.to(roomCode).emit("startHandCricket", {game});
	});

	socket.on("playerMove", async ({roomCode, move}) => {
		const game = games[roomCode];
		if (!game) return;

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
			io.to(roomCode).emit("resetMoves");
			return;
		}
		let move1 = game.currBall[0];
		let move2 = game.currBall[1];
		let newObj = {player1: game.currBall[0], player2: game.currBall[1]};

		if (game.isFirstInnings) {
			game.firstInning.push(newObj);
		} else {
			game.secondInning.push(newObj);
		}

		if (game.currBall[0] === game.currBall[1]) {
			//out
			game.spans[game.battingTurn]++;
			// end of first inning.
			if (game.isFirstInnings) {
				game.targetScore = game.scores[game.battingTurn] + 1;
				game.battingTurn = game.battingTurn === 0 ? 1 : 0;
				game.isFirstInnings = false;
				game.currBall = [-1, -1];
				io.to(roomCode).emit("out", {
					game,
					move1,
					move2,
				});
				return;
			} else {
				// game ends
				if (
					game.scores[game.battingTurn] ==
					game.scores[(game.battingTurn + 1) % 2]
				) {
					game.isGameActive = false;
					game.gameWinner = -1;
					game.currBall = [-1, -1];
					io.to(roomCode).emit("gameover", {
						result: "draw",
						game,
						move1,
						move2,
					});
				} else {
					game.isGameActive = false;
					game.gameWinner = (game.battingTurn + 1) % 2;
					game.currBall = [-1, -1];
					io.to(roomCode).emit("gameover", {
						result: "allout",
						game,
						move1,
						move2,
					});
				}
			}
		} else {
			let runsScored = game.currBall[game.battingTurn];
			game.scores[game.battingTurn] += runsScored;
			game.spans[game.battingTurn] += 1;
			if (!game.isFirstInnings) {
				if (game.scores[game.battingTurn] >= game.targetScore) {
					game.isGameActive = false;
					game.gameWinner = game.battingTurn;
					io.to(roomCode).emit("gameover", {
						result: "chased",
						game,
						move1,
						move2,
					});
				}
			}
		}
		game.currBall = [-1, -1];
		io.to(roomCode).emit("updateGame", {game, move1, move2});
	});

	socket.on("disconnect", async () => {
		console.log(`User disconnected: ${socket.id}`);
		for (let roomCode in games) {
			let game = games[roomCode];
			if (
				typeof game.players[0] != "undefined" &&
				game.players[0].socketId === socket.id
			) {
				console.log("deleted: ", roomCode);
				delete games.roomCode;
			} else if (
				typeof game.players[1] != "undefined" &&
				game.players[1].socketId === socket.id
			) {
				console.log("deleted: ", roomCode);
				delete games.roomCode;
			}
		}
	});
});

server.listen(PORT, () => {
	console.log(`listening on :${PORT}`);
});

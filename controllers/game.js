// const Game = require("../models/game");

// // Create a new game room
// exports.createGame = async (req, res) => {
// 	console.log("create");
// 	const {roomCode, playerName, socketId} = req.body;
// 	try {
// 		// console.log(`${roomCode}, ${playerName}, ${socketId}`);
// 		const game = new Game({
// 			roomCode,
// 			roomOwner: {playerName, socketId},
// 		});
// 		await game.save();
// 		res.status(201).json({roomCode: game.roomCode});
// 	} catch (err) {
// 		res.status(500).json({error: err.message});
// 	}
// };

// // Join an existing game
// exports.joinGame = async (req, res) => {
// 	console.log("join");
// 	const {roomCode, playerName, socketId} = req.body;
// 	try {
// 		const game = await Game.findOne({roomCode});
// 		if (!game) {
// 			return res.status(400).json({error: "Room does not exist"});
// 		}
// 		if (game.playerCount >= 2) {
// 			return res.status(400).json({error: "Room full"});
// 		}
// 		game.playerCount = 2;
// 		game.player2 = socketId;
// 		await game.save();
// 		res.status(200).json({roomCode: game.roomCode});
// 	} catch (err) {
// 		res.status(500).json({error: err.message});
// 	}
// };

// // Fetch game details
// exports.getGame = async (req, res) => {
// 	try {
// 		const game = await Game.findOne({roomCode: req.params.roomCode});
// 		if (!game) return res.status(404).json({error: "Game not found"});
// 		res.status(200).json({game});
// 	} catch (err) {
// 		res.status(500).json({error: err.message});
// 	}
// };
// exports.isGameFull = async (req, res) => {
// 	try {
// 		const game = await Game.findOne({roomCode: req.params.roomCode});
// 		if (!game) return res.status(404).json({error: "Game not found"});
// 		res.status(200).json({value: game.playerCount == 2});
// 	} catch (err) {
// 		res.status(500).json({error: err.message});
// 	}
// };

const {Game} = require("../models/Game");

exports.createGame = async (req, res) => {
	console.log("this.createGame");
	const {roomCode, playerName, socketId} = req.body;
	try {
		const newGame = new Game({
			roomCode,
			players: [{name: playerName, socketId}],
			scores: [0, 0],
		});

		console.log(newGame);
		await newGame.save();
		console.log(roomCode, playerName, socketId);
		res.status(201).json({game: newGame});
	} catch (err) {
		res.status(500).json({error: err.message});
	}
};

exports.joinGame = async (req, res) => {
	const {roomCode, playerName, socketId} = req.body;
	try {
		const game = await Game.findOne({roomCode});
		if (!game || game.players.length >= 2) {
			return res
				.status(400)
				.json({error: "Room is full or does not exist"});
		}
		game.players.push({name: playerName, socketId});
		await game.save();
		res.status(200).json({game});
	} catch (err) {
		res.status(500).json({error: err.message});
	}
};

exports.getGame = async (req, res) => {
	try {
		const game = await Game.findOne({roomCode: req.params.roomCode});
		res.status(200).json({game});
	} catch (err) {
		res.status(500).json({error: err.message});
	}
};

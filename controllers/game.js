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

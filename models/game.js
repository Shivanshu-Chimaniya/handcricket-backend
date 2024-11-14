// // models/Game.js
// const mongoose = require("mongoose");

// const gameSchema = new mongoose.Schema(
// 	{
// 		roomCode: {type: String, required: true, unique: true},
// 		playerCount: {type: Number, default: 0},
// 		roomOwner: {
// 			name: {type: String, default: ""},
// 			sockedId: {type: String, default: ""},
// 		},
// 		players: [
// 			{
// 				name: {type: String, default: ""},
// 				sockedId: {type: String, default: ""},
// 			},
// 		],
// 		toss: {type: Number, default: true}, // 0 or 1
// 		currentTurn: {type: Number, default: 0}, // 0 or 1
// 		firstInning: [{player1: Number, player2: Number}],
// 		secondInning: [{player1: Number, player2: Number}],
// 		gameState: {type: String, default: "waiting"},
// 	},
// 	{timestamps: true}
// );

// module.exports = mongoose.model("Game", gameSchema);

const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema(
	{
		roomCode: {type: String, required: true, unique: true},
		players: [{name: String, socketId: String}],
		p1tossChoice: {type: String, default: null},
		p2tossChoice: {type: String, default: null},
		tossWinner: {type: Number, default: null}, // 0 or 1

		battingTurn: {type: Number, default: 0}, // 0 or 1
		firstInning: [{type: Number}],
		secondInning: [{type: Number}],
		firstSpan: {type: Number, default: 0},
		secondSpan: {type: Number, default: 0},
		isFirstInnings: {type: Boolean, default: true},
		targetScore: {type: Number, default: null},
		currBall: [{type: Number, default: -1}], // [player1Score, player2Score]
		scores: [{type: Number, default: 0}],
		isGameActive: {type: Boolean, default: true},
	},
	{timestamps: true}
);

exports.Game = mongoose.model("Game", gameSchema);

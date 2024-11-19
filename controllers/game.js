const {Game} = require("../models/game");

exports.getGame = async (req, res) => {
	try {
		const game = await Game.findOne({roomCode: req.params.roomCode});
		res.status(200).json(game);
	} catch (err) {
		res.status(500).json({error: err.message});
	}
};

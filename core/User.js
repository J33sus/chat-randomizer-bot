const UserStats = require('./UserStates.js');
const Database = require('./Database.js')();

class User {
	constructor(user_id, register) {
		this.user_id = user_id;
		this.state = UserStats.STATE_PAUSED;
		this.partner = undefined;

		if(register) Database.get('users').push({user_id: user_id, state: this.state}).write();
	}
	getId() { return this.user_id; }

	getPartner() { return this.partner; }
	setPartner(partner, update = true)  { 
		this.partner = partner;

		if(update) Database.get('users').find({ user_id: this.user_id }).set('partner', partner).write();
	}

	setState(state, update = true) {
		this.state = state;

		if(update) Database.get('users').find({ user_id: this.user_id }).set('state', state).write();
	}
	getState() { return this.state; }
};
module.exports = User; 
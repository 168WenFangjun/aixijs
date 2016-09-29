class ExpectimaxTree {
	constructor(agent, model) {
		this.model = model;
		this.horizon = agent.horizon;
		this.ucb = agent.ucb;
		this.max_reward = agent.max_reward;
		this.min_reward = agent.min_reward;
		this.rew_range = this.max_reward - this.min_reward;
		this.numActions = agent.numActions;
		this.samples = agent.samples;
		this.gamma = agent.gamma;
		this.agent = agent; // FARK
		this.reset();
	}

	getValueEstimate() {
		if (!this.sampled) {
			this.model.save();
			for (let iter = 0; iter < this.samples; iter++) {
				this.root.sample(this, 0);
				this.model.load();
			}

			this.sampled = true;
		}

		return this.root.mean;
	}

	bestAction() {
		this.getValueEstimate();

		return Util.argmax(this.root, (n, a) => {
			let child = n.getChild(a);
			return child ? child.mean : 0;
		}, this.numActions);
	}

	getPlan() {
		let current = this.root;
		let ret = [];
		while (current) {
			let a = Util.argmax(current, (n, a) => {
				let child = n.getChild(a);
				return child ? child.mean : 0;
			}, this.numActions);

			ret.push(a);
			let chanceNode = current.getChild(a);

			if (!chanceNode) {
				return ret;
			}

			let child = null;
			let maxVisits = 0;
			for (let [key, val] of chanceNode.children) {
				if (val.visits > maxVisits) {
					child = val; //No tie-breaking for now
					maxVisits = val.visits;
				}
			}

			current = child;
		}

		return ret;
	}

	rollout(horizon, dfr) {
		let reward = 0;
		for (let i = dfr; i < horizon; i++) {
			let action = Math.floor(Math.random() * this.numActions);
			this.model.perform(action);
			let e = this.model.generatePercept();
			this.model.bayesUpdate(action, e);
			reward += this.agent.utility(e, i);
		}

		return reward;
	}

	reset() {
		this.root = new DecisionNode(null, this);
		this.sampled = false;
	}

	prune(a, e) {
		let cn = this.root.getChild(a);
		if (!cn) {
			this.reset();
			return;
		}

		this.root = cn.getChild(e, this);
		if (!this.root) {
			this.reset();
			return;
		}

		this.sampled = false;
	}
}

class DecisionNode {
	constructor(e, tree) {
		this.visits = 0;
		this.mean = 0;
		this.e = e;
		this.children = new Array(tree.numActions);
		this.n_children = 0;
		this.U = Util.randInts(tree.numActions);
	}

	addChild(a) {
		this.children[a] = new ChanceNode(a);
	}

	getChild(a) {
		return this.children[a];
	}

	selectAction(tree) {
		let a;
		if (this.n_children != tree.numActions) {
			a = this.U[this.n_children];
			this.addChild(a);
			this.n_children++;
		} else {
			let max = Number.NEGATIVE_INFINITY;
			for (let action = 0; action < tree.numActions; action++) {
				let child = this.getChild(action);
				let normalization = tree.horizon * tree.rew_range;
				let value = child.mean / normalization + tree.ucb *
					Math.sqrt(Math.log2(this.visits / child.visits));
				if (value > max) {
					max = value;
					a = action;
				}
			}
		}

		return a;
	}

	sample(tree, dfr) {
		let reward = 0;
		if (dfr > tree.horizon) {
			return 0;
		} else if (this.visits == 0) {
			reward = tree.rollout(tree.horizon, dfr);
		} else {
			let action = this.selectAction(tree);
			reward = this.getChild(action).sample(tree, dfr);
		}

		this.mean = (1 / (this.visits + 1)) * (reward + this.visits * this.mean);
		this.visits++;
		return reward;
	}
}

class ChanceNode  {
	constructor(action) {
		this.visits = 0;
		this.mean = 0;
		this.children = new Map();
		this.action = action;
	}

	addChild(e, tree) {
		this.children.set(e.obs * tree.rew_range + e.rew, new DecisionNode(e, tree));
	}

	getChild(e, tree) {
		return this.children.get(e.obs * tree.rew_range + e.rew);
	}

	sample(tree, dfr) {
		let reward = 0;
		if (dfr > tree.horizon) {
			return reward;
		} else {
			tree.model.perform(this.action);
			let e = tree.model.generatePercept();
			tree.model.bayesUpdate(this.action, e);
			if (!this.getChild(e, tree)) {
				this.addChild(e, tree);
			}

			reward = tree.agent.utility(e, dfr) + this.getChild(e, tree).sample(tree, dfr + 1);
		}

		this.mean = (1 / (this.visits + 1)) * (reward + this.visits * this.mean);
		this.visits++;
		return reward;
	}
}
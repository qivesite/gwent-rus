"use strict"

var factions = {
	realms: {
		name: "Королевства Севера",
		factionAbility: player => game.roundStart.push(async () => {
			if (game.roundCount > 1 && game.roundHistory[game.roundCount - 2].winner === player) {
				player.deck.draw(player.hand);
				await ui.notification("north", 1200);
			}
			return false;
		}),
		activeAbility: false,
		abilityUses: 0,
		description: "Возьмите карту из колоды каждый раз, когда вы выигрываете раунд."
	},
	nilfgaard: {
		name: "Нильфгаард",
		description: "Выигрывает любой раунд, закончившийся вничью.",
		activeAbility: false,
		abilityUses: 0
	},
	monsters: {
		name: "Чудовища",
		factionAbility: player => game.roundEnd.push( () => {
			let units = board.row.filter( (r,i) => player === player_me ^ i < 3)
				.reduce((a,r) => r.cards.filter(c => c.isUnit()).concat(a), []);
			if (units.length === 0)
				return;
			let card = units[randomInt(units.length)];
			card.noRemove = true;
			game.roundStart.push(async () => {
				await ui.notification("monsters", 1200);
				delete card.noRemove;
				return true; 
			});
			return false;
		}),
		description: "Оставляет одну случайную карту отряда на поле после каждого раунда.",
		activeAbility: false,
		abilityUses: 0
	},
	scoiatael: {
		name: "Скоя'таэли",
		factionAbility: player => game.gameStart.push(async () => {
			let notif = "";
			if (player === player_me && !(player.controller instanceof ControllerAI)) {
				await ui.popup("Go First [E]", () => game.firstPlayer = player, "Let Opponent Start [Q]", () => game.firstPlayer = player.opponent(), "Would you like to go first?", "The Scoia'tael faction perk allows you to decide who will get to go first.");
				notif = game.firstPlayer.tag + "-first";
			} else if (player.controller instanceof ControllerAI) {
				if (Math.random() < 0.5) {
					game.firstPlayer = player;
					notif = "scoiatael";
				} else {
					game.firstPlayer = player.opponent();
					notif = game.firstPlayer.tag + "-first";
				}
			}
			await ui.notification(notif, 1200);
			return true;
		}),
		description: "Решает, кто ходит первым.",
		activeAbility: false,
		abilityUses: 0
	},
	skellige: {
		name: "Скеллиге",
		factionAbility: player => game.roundStart.push( async () => {
			if (game.roundCount != 3) return false;
			await ui.notification("skellige-" + player.tag, 1200);
			await Promise.all(player.grave.findCardsRandom(c => c.isUnit(), 2).map(c => board.toRow(c, player.grave)));
			return true;
		}),
		description: "В начале третьего раунда 2 случайные карты из кладбища возвращаются на поле боя.",
		activeAbility: false,
		abilityUses: 0
	},
	witcher_universe: {
		name: "Вселенная Ведьмака",
		factionAbility: async player => {
			await ui.notification("witcher_universe", 1200);
		},
		factionAbilityInit: player => game.roundStart.push(async () => {
			player.updateFactionAbilityUses(1);
			return false;
		}),
		description: "Может пропустить ход один раз за раунд.",
		activeAbility: true,
		abilityUses: 1,
		weight: (player) => {
			return 20;
		}
	},
	toussaint: {
		name: "Туссент",
		factionAbility: player => game.roundStart.push(async () => {
			if (game.roundCount > 1 && !(game.roundHistory[game.roundCount - 2].winner === player)) {
				player.deck.draw(player.hand);
				await ui.notification("toussaint", 1200);
			}
			return false;
		}),
		activeAbility: false,
		abilityUses: 0,
		description: "Возьмите карту из колоды каждый раз, когда вы проигрываете раунд."
	},
	lyria_rivia: {
		name: "Лирия и Ривия",
		factionAbility: player => {
			let card = new Card("spe_lyria_rivia_morale", card_dict["spe_lyria_rivia_morale"], player);
			card.removed.push(() => setTimeout(() => card.holder.grave.removeCard(card), 2000));
			card.placed.push(async () => await ui.notification("lyria_rivia", 1200));
			player.endTurnAfterAbilityUse = false;
			ui.showPreviewVisuals(card);
			ui.enablePlayer(true);
			if (!(player.controller instanceof ControllerAI)) ui.setSelectable(card, true);
		},
		activeAbility: true,
		abilityUses: 1,
		description: "Примените эффект Поднятия боевого духа на выбранном ряду (увеличьте силу всех отрядов на 1 в этом ходу).",
		weight: (player) => {
			let units = player.getAllRowCards().concat(player.hand.cards).filter(c => c.isUnit()).filter(c => !c.abilities.includes("spy"));
			let rowStats = {
				"close": 0,
				"ranged": 0,
				"siege": 0,
				"agile": 0
			};
			units.forEach(c => {
				rowStats[c.row] += 1;
			});
			rowStats["close"] += rowStats["agile"];
			return Math.max(rowStats["close"], rowStats["ranged"], rowStats["siege"]);
		}
	},
	syndicate: {
		name: "Синдикат",
		factionAbility: player => game.gameStart.push(async () => {
			let card = new Card("sy_sigi_reuven", card_dict["sy_sigi_reuven"], player);
			await board.addCardToRow(card, card.row, card.holder);
		}),
		activeAbility: false,
		abilityUses: 0,
		description: "Начинает игру с картой героя Сиги Ройвена на поле."
	},
	zerrikania: {
		name: "Зеррикания",
		factionAbility: player => game.roundStart.push(async () => {
			if (game.roundCount > 1 && !(game.roundHistory[game.roundCount - 2].winner === player)) {
				if (player.grave.findCards(c => c.isUnit()) <= 0) return;
				let grave = player.grave;
				let respawns = [];
				if (player.controller instanceof ControllerAI) {
					respawns.push({
						card: player.controller.medic(player.leader, grave)
					});
				} else {
					await ui.queueCarousel(player.grave, 1, (c, i) => respawns.push({
						card: c.cards[i]
					}), c => c.isUnit(), true);
				}
				await Promise.all(respawns.map(async wrapper => {
					let res = wrapper.card;
					grave.removeCard(res);
					grave.addCard(res);
					await res.animate("medic");
					await res.autoplay(grave);
				}));
				await ui.notification("zerrikania", 1200);
			}
			return false;
		}),
		activeAbility: false,
		abilityUses: 0,
		description: "Восстановите карту отряда по вашему выбору каждый раз, когда вы проигрываете раунд."
	}
}
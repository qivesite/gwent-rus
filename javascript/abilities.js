
"use strict"

var ability_dict = {
	clear: {
		name: "Ясная погода",
		description: "Убирает эффекты всех карт погоды (Пронизывающий иней, Непроглядный туман и Проливной дождь). "
	},
	frost: {
		name: "Пронизывающий иней",
		description: "Устанавливает силу всех карт ближнего боя равной 1 для обоих игроков. "
	},
	fog: {
		name: "Непроглядный туман",
		description: "Устанавливает силу всех картов дальнего боя равной 1 для обоих игроков. "
	},
	rain: {
		name: "Проливной дождь",
		description: "Устанавливает силу всех карт осадного боя равной 1 для обоих игроков. "
	},
	storm: {
		name: "Шторм Скеллиге",
		description: "Уменьшает силу всех отрядов дальнего боя и осадных отрядов до 1. "
	},
	hero: {
		name: "Герой",
		description: "Не подвержен действию особых карт или способностей. "
	},
	decoy: {
		name: "Приманка",
		description: "Обменяйте на уже выложенную карту, чтобы вернуть ее в руку. "
	},
	horn: {
		name: "Рог командора",
		description: "Удваивает силу всех карт отрядов в этом ряду. Не более одной на ряд. ",
		placed: async card => await card.animate("horn")
	},
	mardroeme: {
		name: "Мардроэме",
		description: "Запускает превращение всех карт берсерков в том же ряду. ",
		placed: async (card, row) => {
			if (card.isLocked()) return;
			let berserkers = row.findCards(c => c.abilities.includes("berserker"));
			await Promise.all(berserkers.map(async c => await ability_dict["berserker"].placed(c, row)));
		}
	},
	berserker: {
		name: "Берсерк",
		description: "Превращается в медведя, если в его ряду есть карта Мардроэме. ",
		placed: async (card, row) => {
			if (row.effects.mardroeme === 0 || card.isLocked()) return;
			row.removeCard(card);
			await row.addCard(new Card(card.target, card_dict[card.target], card.holder));
		}
	},
	scorch: {
		name: "Сожжение",
		description: "Сбрасывается после розыгрыша. Убивает самую сильную карту (карты) на поле боя. ",
		activated: async card => {	
			await ability_dict["scorch"].placed(card);
			await board.toGrave(card, card.holder.hand);
		},
		placed: async (card, row) => {
			if (card.isLocked() || game.scorchCancelled) return;
			if (row !== undefined) row.cards.splice(row.cards.indexOf(card), 1);
			let maxUnits = board.row.map(r => [r, r.maxUnits()]).filter(p => p[1].length > 0).filter(p => !p[0].isShielded());
			if (row !== undefined) row.cards.push(card);
			let maxPower = maxUnits.reduce((a,p) => Math.max(a, p[1][0].power), 0);
			let scorched = maxUnits.filter(p => p[1][0].power === maxPower);
			let cards = scorched.reduce((a, p) => a.concat(p[1].map(u => [p[0], u])), []);
			await Promise.all(cards.map(async u => await u[1].animate("scorch", true, false)));
			await Promise.all(cards.map(async u => await board.toGrave(u[1], u[0])));
		}
	},
	scorch_c: {
		name: "Сожжение - ближний бой",
		description: "Уничтожает самый сильный отряд ближнего боя противника (или несколько, если их сила одинакова), если общая сила всех его отрядов ближнего боя составляет 10 или более. ",
		placed: async (card) => await board.getRow(card, "close", card.holder.opponent()).scorch()
	},
	scorch_r: {
		name: "Сожжение - дальний бой",
		description: "Уничтожает самый сильный отряд дальнего боя противника (или несколько), если общая сила всех его отрядов дальнего боя составляет 10 или более. ",
		placed: async (card) => await board.getRow(card, "ranged", card.holder.opponent()).scorch()
	},
	scorch_s: {
		name: "Сожжение - осада",
		description: "Уничтожает самый сильный осадный отряд противника (или несколько), если общая сила всех его осадных отрядов составляет 10 или более. ",
		placed: async (card) => await board.getRow(card, "siege", card.holder.opponent()).scorch()
	},
	agile: {
		name:"Проворный", 
		description: "Может быть помещен либо в ряд ближнего боя, либо в ряд дальнего боя. Не может быть перемещен после размещения. "
	},
	muster: {
		name:"Сбор", 
		description: "Находит все карты с таким же названием в вашей колоде и немедленно разыгрывает их. ",
		placed: async (card) => {
			if (card.isLocked()) return;
			let pred = c => c.target === card.target;
			let units = card.holder.hand.getCards(pred).map(x => [card.holder.hand, x])
				.concat(card.holder.deck.getCards(pred).map(x => [card.holder.deck, x]));
			if (units.length === 0) return;
			await card.animate("muster");
			if (card.row === "agile") await Promise.all(units.map(async p => await board.addCardToRow(p[1], card.currentLocation, p[1].holder, p[0])));
			else await Promise.all(units.map(async p => await board.addCardToRow(p[1], p[1].row, p[1].holder, p[0])));
		}
	},
	spy: {
		name: "Шпион",
		description: "Помещается на поле боя противника (учитывается в общем счете противника) и позволяет взять 2 карты из вашей колоды. ",
		placed: async (card) => {
			if (card.isLocked()) return;
			await card.animate("spy");
			for (let i = 0; i < 2; i++) {
				if (card.holder.deck.cards.length > 0) await card.holder.deck.draw(card.holder.hand);
			}
			card.holder = card.holder.opponent();
		}
	},
	medic: {
		name: "Медик",
		description: "Выберите одну карту из вашего сброса и немедленно разыграйте её (не героев и не особые карты). ",
		placed: async (card) => {
			if (card.isLocked() || (card.holder.grave.findCards(c => c.isUnit()) <= 0)) return;
			let grave = board.getRow(card, "grave", card.holder);
			let respawns = [];
			if (game.randomRespawn) {
				for (var i = 0; i < game.medicCount; i++) {
					if (card.holder.grave.findCards(c => c.isUnit()).length > 0) {
						let res = grave.findCardsRandom(c => c.isUnit())[0];
						grave.removeCard(res);
						grave.addCard(res);
						await res.animate("medic");
						await res.autoplay(grave);
					}
				}
				return;
			} else if (card.holder.controller instanceof ControllerAI) {
				for (var i = 0; i < game.medicCount; i++) {
					if (card.holder.grave.findCards(c => c.isUnit()).length > 0) {
						let res = card.holder.controller.medic(card, grave);
						grave.removeCard(res);
						grave.addCard(res);
						await res.animate("medic");
						await res.autoplay(grave);
					}
				}
				return;
			}
			await ui.queueCarousel(card.holder.grave, game.medicCount, (c, i) => respawns.push({ card: c.cards[i] }), c => c.isUnit(), true);
			await Promise.all(respawns.map(async wrapper => {
				let res = wrapper.card;
				grave.removeCard(res);
				grave.addCard(res);
				await res.animate("medic");
				await res.autoplay(grave);
			}));
		}
	},
	morale: {
		name: "Поднятие боевого духа",
		description: "Дает +1 всем отрядам в ряду (кроме себя). ",
		placed: async card => await card.animate("morale")
	},
	bond: {
		name: "Крепкая связь",
		description: "Поместите рядом с картой с таким же названием, чтобы удвоить силу обеих карт. ",
		placed: async card => {
			if (card.isLocked()) return;
			let bonds = card.currentLocation.findCards(c => c.target === card.target).filter(c => c.abilities.includes("bond")).filter(c => !c.isLocked());
			if (bonds.length > 1) await Promise.all(bonds.map(c => c.animate("bond")));
		}
	},
	avenger: {
		name: "Мститель",
		description: "Когда эта карта удаляется с поля боя, она призывает мощную новую карту отряда, которая занимает её место. ",
		removed: async (card) => {
			if (game.over || game.roundHistory.length > 2 || card.isLocked()) return;
			if (card_dict[card.target]["ability"].includes("muster") && (card.holder.deck.findCards(c => c.key === card.target).length === 0 && card.holder.hand.findCards(c => c.key === card.target).length === 0)) {
				for (let i = 0; i < card_dict[card.target]["count"]; i++) {
					let avenger = new Card(card.target, card_dict[card.target], card.holder);
					avenger.removed.push(() => setTimeout(() => avenger.holder.grave.removeCard(avenger), 2000));
					if (card.target != card.key) await board.addCardToRow(avenger, avenger.row, card.holder);
				}
			} else if (card.target === card.key) await board.moveTo(card, card.row, card.holder.grave);
			else {
				let avenger;
				if (card.holder.deck.findCards(c => c.key === card.target).length) {
					avenger = card.holder.deck.findCard(c => c.key === card.target);
					await board.moveTo(avenger, avenger.row, card.holder.deck);
				} else if (card.holder.hand.findCards(c => c.key === card.target).length) {
					avenger = card.holder.hand.findCard(c => c.key === card.target);
					await board.moveTo(avenger, avenger.row, card.holder.hand);
				} else {
					avenger = new Card(card.target, card_dict[card.target], card.holder);
					await board.addCardToRow(avenger, avenger.row, card.holder);
					if (card.target != card.key) avenger.removed.push(() => setTimeout(() => avenger.holder.grave.removeCard(avenger), 2000));
				}
			}
		},
		weight: (card) => {
			if (game.roundHistory.length > 2) return 1;
			return Number(card_dict[card.target]["strength"]);
		}
	},
	cintra_slaughter: {
		name: "Резня в Цинтре",
		description: "При использовании особой карты «Резня в Цинтре» уничтожьте все отряды на вашей стороне поля, обладающие способностью «Резня в Цинтре», затем возьмите количество карт, равное количеству уничтоженных отрядов.",
		activated: async card => {
			let targets = board.row.map(r => [r, r.findCards(c => c.abilities.includes("cintra_slaughter")).filter(c => c.holder === card.holder).filter(c => !c.isLocked())]);
			let cards = targets.reduce((a, p) => a.concat(p[1].map(u => [p[0], u])), []);
			let nb_draw = cards.length;
			await Promise.all(cards.map(async u => await u[1].animate("scorch", true, false)));
			await Promise.all(cards.map(async u => await board.toGrave(u[1], u[0])));
			await board.toGrave(card, card.holder.hand);
			for (let i = 0; i < nb_draw; i++) {
				if (card.holder.deck.cards.length > 0) await card.holder.deck.draw(card.holder.hand);
			}
		},
		weight: (card) => 30
	},
	foltest_king: {
		description: "Возьмите карту «Непроглядный туман» из вашей колоды и немедленно разыграйте её.",
		activated: async card => {
			let out = card.holder.deck.findCard(c => c.name === "Impenetrable Fog");
			if (out) await out.autoplay(card.holder.deck);
		},
		weight: (card, ai) => ai.weightWeatherFromDeck(card, "fog")
	},
	foltest_lord: {
		description: "Убирает все эффекты погоды (от карт «Пронизывающий иней», «Проливной дождь» или «Непроглядный туман») на поле.",
		activated: async () => {
			tocar("clear", false);
			await weather.clearWeather()
		},
		weight: (card, ai) =>  ai.weightCard(card_dict["spe_clear"])
	},
	foltest_siegemaster: {
		description: "Удваивает силу всех ваших осадных отрядов (если только в этом ряду также не присутствует «Рог командора»).",
		activated: async card => await board.getRow(card, "siege", card.holder).leaderHorn(card),
		weight: (card, ai) => ai.weightHornRow(card, board.getRow(card, "siege", card.holder))
	},
	foltest_steelforged: {
		description: "Уничтожает самый сильный осадный отряд противника (или несколько), если общая сила всех его осадных отрядов составляет 10 или более.",
		activated: async card => await ability_dict["scorch_s"].placed(card),
		weight: (card, ai, max) => ai.weightScorchRow(card, max, "siege")
	},
	foltest_son: {
		description: "Уничтожает самый сильный отряд дальнего боя противника (или несколько), если общая сила всех его отрядов дальнего боя составляет 10 или более.",
		activated: async card => await ability_dict["scorch_r"].placed(card),
		weight: (card, ai, max) => ai.weightScorchRow(card, max, "ranged")
	},
	emhyr_imperial: {
		description: "Возьмите карту «Проливной дождь» из вашей колоды и немедленно разыграйте её.",
		activated: async card => {
			let out = card.holder.deck.findCard(c => c.name === "Torrential Rain");
			if (out) await out.autoplay(card.holder.deck);
		},
		weight: (card, ai) => ai.weightWeatherFromDeck(card, "rain")
	},
	emhyr_emperor: {
		description: "Посмотрите 3 случайные карты из руки противника.",
		activated: async card => {
			if (card.holder.controller instanceof ControllerAI) return;
			let container = new CardContainer();
			container.cards = card.holder.opponent().hand.findCardsRandom(() => true, 3);
			try {
				Carousel.curr.cancel();
			} catch (err) {}
			await ui.viewCardsInContainer(container);
		},
		weight: card => {
			let count = card.holder.opponent().hand.cards.length;
			return count === 0 ? 0 : Math.max(10, 10 * (8 - count));
		}
	},
	emhyr_whiteflame: {
		description: "Отменяет способность лидера противника."
	},
	emhyr_relentless: {
		description: "Возьмите карту из сброса противника.",
		activated: async card => {
			let grave = board.getRow(card, "grave", card.holder.opponent());
			if (grave.findCards(c => c.isUnit()).length === 0) return;
			if (card.holder.controller instanceof ControllerAI) {
				let newCard = card.holder.controller.medic(card, grave);
				newCard.holder = card.holder;
				await board.toHand(newCard, grave);
				return;
			}
			try {
				Carousel.curr.cancel();
			} catch (err) {}
			await ui.queueCarousel(grave, 1, (c,i) => {
				let newCard = c.cards[i];
				newCard.holder = card.holder;
				board.toHand(newCard, grave);
			}, c => c.isUnit(), true);
		},
		weight: (card, ai, max, data) => ai.weightMedic(data, 0, card.holder.opponent())
	},
	emhyr_invader: {
		description: "Способности, возвращающие отряд на поле боя, возвращают случайно выбранный отряд. Влияет на обоих игроков.",
		gameStart: () => game.randomRespawn = true
	},
	eredin_commander: {
		description: "Удваивает силу всех ваших отрядов ближнего боя (если только в этом ряду также не присутствует «Рог командора»).",
		activated: async card => await board.getRow(card, "close", card.holder).leaderHorn(card),
		weight: (card, ai) => ai.weightHornRow(card, board.getRow(card, "close", card.holder))
	},
	eredin_bringer_of_death: {
		name: "Эредин: Вестник смерти",
		description: "Верните карту из вашего сброса в руку.",
		activated: async card => {
			let newCard;
			if (card.holder.controller instanceof ControllerAI) newCard = card.holder.controller.medic(card, card.holder.grave);
			else {
				try {
					Carousel.curr.exit();
				} catch (err) {}
				await ui.queueCarousel(card.holder.grave, 1, (c,i) => newCard = c.cards[i], c => c.isUnit(), false, false);
			}
			if (newCard) await board.toHand(newCard, card.holder.grave);
		},
		weight: (card, ai, max, data) => ai.weightMedic(data, 0, card.holder)
	},
	eredin_destroyer: {
		description: "Сбросьте 2 карты и возьмите 1 карту по вашему выбору из вашей колоды.",
		activated: async (card) => {
			let hand = board.getRow(card, "hand", card.holder);
			let deck = board.getRow(card, "deck", card.holder);
			if (card.holder.controller instanceof ControllerAI) {
				let cards = card.holder.controller.discardOrder(card).splice(0, 2).filter(c => c.basePower < 7);
				await Promise.all(cards.map(async c => await board.toGrave(c, card.holder.hand)));
				card.holder.deck.draw(card.holder.hand);
				return;
			} else {
				try {
					Carousel.curr.exit();
				} catch (err) {}
			}
			await ui.queueCarousel(hand, 2, (c,i) => board.toGrave(c.cards[i], c), () => true);
			await ui.queueCarousel(deck, 1, (c,i) => board.toHand(c.cards[i], deck), () => true, true);
		},
		weight: (card, ai) => {
			let cards = ai.discardOrder(card).splice(0,2).filter(c => c.basePower < 7);
			if (cards.length < 2) return 0;
			return cards[0].abilities.includes("muster") ? 50 : 25;
		}
	},
	eredin_king: {
		description: "Возьмите любую карту погоды из вашей колоды и немедленно разыграйте её.",
		activated: async card => {
			let deck = board.getRow(card, "deck", card.holder);
			if (card.holder.controller instanceof ControllerAI) await ability_dict["eredin_king"].helper(card).card.autoplay(card.holder.deck);
			else {
				try {
					Carousel.curr.cancel();
				} catch (err) { }
				await ui.queueCarousel(deck, 1, (c,i) => board.toWeather(c.cards[i], deck), c => c.faction === "weather", true);
			}
		},
		weight: (card, ai, max) => ability_dict["eredin_king"].helper(card).weight,
		helper: card => {
			let weather = card.holder.deck.cards.filter(c => c.row === "weather").reduce((a,c) => a.map(c => c.name).includes(c.name) ? a : a.concat([c]), []);
			let out, weight = -1;
			weather.forEach(c => {
				let w = card.holder.controller.weightWeatherFromDeck(c, c.abilities[0]);
				if (w > weight) {
					weight = w;
					out = c;
				}
			});
			return {
				card: out,
				weight: weight
			};
		}
	},
	eredin_treacherous: {
		description: "Удваивает силу всех карт шпионов (влияет на обоих игроков).",
		gameStart: () => game.spyPowerMult = 2
	},
	francesca_queen: {
		description: "Уничтожает самый сильный отряд ближнего боя противника (или несколько), если общая сила всех его отрядов ближнего боя составляет 10 или более.",
		activated: async card => await ability_dict["scorch_c"].placed(card),
		weight: (card, ai, max) => ai.weightScorchRow(card, max, "close")
	},
	francesca_beautiful: {
		description: "Удваивает силу всех ваших отрядов дальнего боя (если только в этом ряду также не присутствует «Рог командора»).",
		activated: async card => await board.getRow(card, "ranged", card.holder).leaderHorn(card),
		weight: (card, ai) => ai.weightHornRow(card, board.getRow(card, "ranged", card.holder))
	},
	francesca_daisy: {
		description: "Возьмите дополнительную карту в начале битвы.",
		placed: card => game.gameStart.push(() => {
			let draw = card.holder.deck.removeCard(0);
			card.holder.hand.addCard(draw);
			return true;
		})
	},
	francesca_pureblood: {
		description: "Возьмите карту «Пронизывающий иней» из вашей колоды и немедленно разыграйте её.",
		activated: async card => {
			let out = card.holder.deck.findCard(c => c.name === "Biting Frost");
			if (out) await out.autoplay(card.holder.deck);
		},
		weight: (card, ai) => ai.weightWeatherFromDeck(card, "frost")
	},
	francesca_hope: {
		description: "Перемещает проворные отряды в тот допустимый ряд, который максимизирует их силу (не перемещает отряды, уже находящиеся в оптимальном ряду).",
		activated: async card => {
			let close = board.getRow(card, "close");
			let ranged =  board.getRow(card, "ranged");
			let cards = ability_dict["francesca_hope"].helper(card);
			await Promise.all(cards.map(async p => await board.moveTo(p.card, p.row === close ? ranged : close, p.row)));
		},
		weight: card => {
			let cards = ability_dict["francesca_hope"].helper(card);
			return cards.reduce((a,c) => a + c.weight, 0);
		},
		helper: card => {
			let close = board.getRow(card, "close");
			let ranged = board.getRow(card, "ranged");
			return validCards(close).concat(validCards(ranged));
			
			function validCards(cont) {
				return cont.findCards(c => c.row === "agile").filter(c => dif(c,cont) > 0).map(c => ({
					card:c, row:cont, weight:dif(c,cont)
				}))
			}
			
			function dif(card, source) {
				return (source === close ? ranged : close).calcCardScore(card) - card.power;
			}
		}
	},
	crach_an_craite: {
		description: "Замешивает все карты из кладбища каждого игрока обратно в их колоды.",
		activated: async card => {
			Promise.all(card.holder.grave.cards.map(c => board.toDeck(c, card.holder.grave)));
			await Promise.all(card.holder.opponent().grave.cards.map(c => board.toDeck(c, card.holder.opponent().grave)));
		},
		weight: (card, ai, max, data) => {
			if (game.roundCount < 2) return 0;
			let medics = card.holder.hand.findCard(c => c.abilities.includes("medic"));
			if (medics !== undefined) return 0;
			let spies = card.holder.hand.findCard(c => c.abilities.includes("spy"));
			if (spies !== undefined) return 0;
			if (card.holder.hand.findCard(c => c.abilities.includes("decoy")) !== undefined && (data.medic.length || data.spy.length && card.holder.deck.findCard(c => c.abilities.includes("medic")) !== undefined)) return 0;
			return 15;
		}
	},
	king_bran: {
		description: "Отряды теряют только половину своей силы в условиях плохой погоды.",
		placed: card => {
			for (var i = 0; i < board.row.length; i++) {
				if ((card.holder === player_me && i > 2) || (card.holder === player_op && i < 3)) board.row[i].halfWeather = true;
			}
		}
	},
	queen_calanthe: {
		description: "Разыграйте отряд, затем возьмите карту из вашей колоды.",
		activated: async card => {
			let units = card.holder.hand.cards.filter(c => c.isUnit());
			if (units.length === 0) return;
			let wrapper = {
				card: null
			};
			if (card.holder.controller instanceof ControllerAI) wrapper.card = units[randomInt(units.length)];
			else await ui.queueCarousel(board.getRow(card, "hand", card.holder), 1, (c, i) => wrapper.card = c.cards[i], c => c.isUnit(), true);
			wrapper.card.autoplay();
			card.holder.hand.removeCard(wrapper.card);
			if (card.holder.deck.cards.length > 0) await card.holder.deck.draw(card.holder.hand);
		},
		weight: (card, ai) => {
			let units = card.holder.hand.cards.filter(c => c.isUnit());
			if (units.length === 0) return 0;
			return 15;
		}
	},
	fake_ciri: {
		description: "Сбросьте карту из руки, затем возьмите две карты из вашей колоды.",
		activated: async card => {
			if (card.holder.hand.cards.length === 0) return;
			let hand = board.getRow(card, "hand", card.holder);
			if (card.holder.controller instanceof ControllerAI) {
				let cards = card.holder.controller.discardOrder(card).splice(0, 1).filter(c => c.basePower < 7);
				await Promise.all(cards.map(async c => await board.toGrave(c, card.holder.hand)));
			} else {
				try {
					Carousel.curr.exit();
				} catch (err) {}
				await ui.queueCarousel(hand, 1, (c, i) => board.toGrave(c.cards[i], c), () => true);
			}
			for (let i = 0; i < 2; i++) {
				if (card.holder.deck.cards.length > 0) await card.holder.deck.draw(card.holder.hand);
			}
		},
		weight: (card, ai) => {
			if (card.holder.hand.cards.length === 0) return 0;
			return 15;
		}
	},
	radovid_stern: {
		description: "Сбросьте 2 карты и возьмите 1 карту по вашему выбору из вашей колоды.",
		activated: async (card) => {
			let hand = board.getRow(card, "hand", card.holder);
			let deck = board.getRow(card, "deck", card.holder);
			if (card.holder.controller instanceof ControllerAI) {
				let cards = card.holder.controller.discardOrder(card).splice(0, 2).filter(c => c.basePower < 7);
				await Promise.all(cards.map(async c => await board.toGrave(c, card.holder.hand)));
				card.holder.deck.draw(card.holder.hand);
				return;
			} else {
				try {
					Carousel.curr.exit();
				} catch (err) {}
			}
			await ui.queueCarousel(hand, 2, (c, i) => board.toGrave(c.cards[i], c), () => true);
			await ui.queueCarousel(deck, 1, (c, i) => board.toHand(c.cards[i], deck), () => true, true);
		},
		weight: (card, ai) => {
			let cards = ai.discardOrder(card).splice(0, 2).filter(c => c.basePower < 7);
			if (cards.length < 2) return 0;
			return cards[0].abilities.includes("muster") ? 50 : 25;
		}
	},
	radovid_ruthless: {
		description: "Отменяет способность «Сожжение» на один раунд.",
		activated: async card => {
			game.scorchCancelled = true;
			await ui.notification("north-scorch-cancelled", 1200);
			game.roundStart.push(async () => {
				game.scorchCancelled = false;
				return true;
			});
		}
	},
	vilgefortz_magician_kovir: {
		description: "Уменьшает вдвое силу всех карт шпионов (влияет на обоих игроков).",
		gameStart: () => game.spyPowerMult = 0.5
	},
	cosimo_malaspina: {
		description: "Уничтожает самый сильный отряд ближнего боя противника (или несколько), если общая сила всех его отрядов ближнего боя составляет 10 или более.",
		activated: async card => await ability_dict["scorch_c"].placed(card),
		weight: (card, ai, max) => ai.weightScorchRow(card, max, "close")
	},
	resilience: {
		name: "Стойкость",
		description: "Остается на доске в следующем раунде, если другой отряд на вашей стороне поля имел общую способность.",
		placed: async card => {
			game.roundEnd.push(async () => {
				if (card.isLocked()) return;
				let units = card.holder.getAllRowCards().filter(c => c.abilities.includes(card.abilities.at(-1)));
				if (units.length < 2) return;
				card.noRemove = true;
				await card.animate("resilience");
				game.roundStart.push(async () => {
					delete card.noRemove;
					let school = card.abilities.at(-1);
					if (!card.holder.effects["witchers"][school]) card.holder.effects["witchers"][school] = 0;
					card.holder.effects["witchers"][school]++;
					return true;
				});
			});
		}
	},
	witcher_wolf_school: {
		name: "Волчья школа ведьмаков",
		description: "Каждый отряд этой ведьмачьей школы получает +2 к силе за каждую карту этой школы.",
		placed: async card => {
			let school = card.abilities.at(-1);
			if (!card.holder.effects["witchers"][school]) card.holder.effects["witchers"][school] = 0;
			card.holder.effects["witchers"][school]++;
		},
		removed: async card => {
			let school = card.abilities.at(-1);
			card.holder.effects["witchers"][school]--;
		}
	},
	witcher_viper_school: {
		name: "Школа змеи ведьмаков",
		description: "Каждый отряд этой ведьмачьей школы получает +2 к силе за каждую карту этой школы.",
		placed: async card => {
			let school = card.abilities.at(-1);
			if (!card.holder.effects["witchers"][school]) card.holder.effects["witchers"][school] = 0;
			card.holder.effects["witchers"][school]++;
		},
		removed: async card => {
			let school = card.abilities.at(-1);
			card.holder.effects["witchers"][school]--;
		}
	},
	witcher_bear_school: {
		name: "Медвежья школа ведьмаков",
		description: "Каждый отряд этой ведьмачьей школы получает +2 к силе за каждую карту этой школы.",
		placed: async card => {
			let school = card.abilities.at(-1);
			if (!card.holder.effects["witchers"][school]) card.holder.effects["witchers"][school] = 0;
			card.holder.effects["witchers"][school]++;
		},
		removed: async card => {
			let school = card.abilities.at(-1);
			card.holder.effects["witchers"][school]--;
		}
	},
	witcher_cat_school: {
		name: "Кошачья школа ведьмаков",
		description: "Каждый отряд этой ведьмачьей школы получает +2 к силе за каждую карту этой школы.",
		placed: async card => {
			let school = card.abilities.at(-1);
			if (!card.holder.effects["witchers"][school]) card.holder.effects["witchers"][school] = 0;
			card.holder.effects["witchers"][school]++;
		},
		removed: async card => {
			let school = card.abilities.at(-1);
			card.holder.effects["witchers"][school]--;
		}
	},
	witcher_griffin_school: {
		name: "Школа грифа ведьмаков",
		description: "Каждый отряд этой ведьмачьей школы получает +2 к силе за каждую карту этой школы.",
		placed: async card => {
			let school = card.abilities.at(-1);
			if (!card.holder.effects["witchers"][school]) card.holder.effects["witchers"][school] = 0;
			card.holder.effects["witchers"][school]++;
		},
		removed: async card => {
			let school = card.abilities.at(-1);
			card.holder.effects["witchers"][school]--;
		}
	},
	shield: {
		name: "Щит",
		description: "Защищает отряды в ряду от всех способностей, кроме эффектов погоды.",
		weight: (card) => 30
	},
	seize: {
		name: "Захват",
		description: "Перемещает отряд(ы) ближнего боя с наименьшей силой на вашей стороне поля. Их способности больше не работают.",
		activated: async card => {
			let opCloseRow = board.getRow(card, "close", card.holder.opponent());
			let meCloseRow = board.getRow(card, "close", card.holder);
			if (opCloseRow.isShielded()) return;
			let units = opCloseRow.minUnits();
			if (units.length === 0) return;
			await Promise.all(units.map(async c => await c.animate("seize")));
			units.forEach(async c => {
				c.holder = card.holder;
				await board.moveToNoEffects(c, meCloseRow, opCloseRow);
			});
			await board.toGrave(card, card.holder.hand);
		},
		weight: (card) => {
			if (card.holder.opponent().getAllRows()[0].isShielded()) return 0;
			return card.holder.opponent().getAllRows()[0].minUnits().reduce((a, c) => a + c.power, 0) * 2
		}
	},
	lock: {
		name: "Блокировка",
		description: "Блокирует/отменяет способность следующего разыгранного в этом ряду отряда (игнорирует отряды без способностей и героев).",
		weight: (card) => 20
	},
	knockback: {
		name: "Отбрасывание",
		description: "Отталкивает все отряды выбранного ряда (ближнего или дальнего боя) или ряда назад к осадному ряду, игнорирует щиты.",
		activated: async (card, row) => {
			let units = row.findCards(c => c.isUnit());
			if (units.length > 0) {
				let targetRow;
				for (var i = 0; i < board.row.length; i++) {
					if (board.row[i] === row) {
						if (i < 3) targetRow = board.row[Math.max(0, i - 1)];
						else targetRow = board.row[Math.min(5, i + 1)];
					}
				}
				await Promise.all(units.map(async c => await c.animate("knockback")));
				units.map(async c => {
					if (c.abilities.includes("bond") || c.abilities.includes("morale") || c.abilities.includes("horn")) await board.moveTo(c, targetRow, row);
					else await board.moveToNoEffects(c, targetRow, row);
				});
			}
			await board.toGrave(card, card.holder.hand);
		},
		weight: (card) => {
			if (board.getRow(card, "close", card.holder.opponent()).cards.length + board.getRow(card, "ranged", card.holder.opponent()).cards.length === 0) return 0;
			let score = 0;
			if (board.getRow(card, "close", card.holder.opponent()).cards.length > 0 && (
					board.getRow(card, "close", card.holder.opponent()).effects.horn > 0 ||
					board.getRow(card, "ranged", card.holder.opponent()).effects.weather ||
					Object.keys(board.getRow(card, "close", card.holder.opponent()).effects.bond).length > 1 ||
					board.getRow(card, "close", card.holder.opponent()).isShielded()
				)
			) score = Math.floor(board.getRow(card, "close", card.holder.opponent()).cards.filter(c => c.isUnit()).reduce((a, c) => a + c.power, 0) * 0.5);
			if (board.getRow(card, "ranged", card.holder.opponent()).cards.length > 0 && (
					board.getRow(card, "ranged", card.holder.opponent()).effects.horn > 0 ||
					board.getRow(card, "siege", card.holder.opponent()).effects.weather ||
					Object.keys(board.getRow(card, "ranged", card.holder.opponent()).effects.bond).length > 1 ||
					board.getRow(card, "ranged", card.holder.opponent()).isShielded()
				)
			) score = Math.floor(board.getRow(card, "close", card.holder.opponent()).cards.filter(c => c.isUnit()).reduce((a, c) => a + c.power, 0) * 0.5);
			return Math.max(1, score);
		}
	},
	alzur_maker: {
		description: "Уничтожьте один из ваших отрядов на поле и призовите Кощея.",
		activated: (card, player) => {
			player.endTurnAfterAbilityUse = false;
			ui.showPreviewVisuals(card);
			ui.enablePlayer(true);
			if(!(player.controller instanceof ControllerAI)) ui.setSelectable(card, true);
		},
		target: "wu_koshchey",
		weight: (card, ai, max) => {
			if (ai.player.getAllRowCards().filter(c => c.isUnit()).length === 0) return 0;
			return ai.weightScorchRow(card, max, "close");
		}
	},
	vilgefortz_sorcerer: {
		description: "Убирает все эффекты погоды на поле.",
		activated: async () => {
			tocar("clear", false);
			await weather.clearWeather()
		},
		weight: (card, ai) => ai.weightCard(card_dict["spe_clear"])
	},
	anna_henrietta_duchess: {
		description: "Уничтожьте один «Рог командора» в любом ряду противника по вашему выбору.",
		activated: (card, player) => {
			player.endTurnAfterAbilityUse = false;
			ui.showPreviewVisuals(card);
			ui.enablePlayer(true);
			if (!(player.controller instanceof ControllerAI)) ui.setSelectable(card, true);
		},
		weight: (card, ai) => {
			let horns = card.holder.opponent().getAllRows().filter(r => r.special.findCards(c => c.abilities.includes("horn")).length > 0).sort((a, b) => b.total - a.total);
			if (horns.length === 0) return 0;
			return horns[0].total;
		}
	},
	toussaint_wine: {
		name: "Туссентское вино",
		description: "Помещается в ряд ближнего или дальнего боя, усиливает все отряды выбранного ряда на два. Не более одного на ряд.",
		placed: async card => await card.animate("morale")
	},
	anna_henrietta_ladyship: {
		description: "Верните отряд из вашего сброса и немедленно разыграйте его.",
		activated: async card => {
			let newCard;
			if (card.holder.controller instanceof ControllerAI) newCard = card.holder.controller.medic(card, card.holder.grave);
			else {
				try {
					Carousel.curr.exit();
				} catch (err) {}
				await ui.queueCarousel(card.holder.grave, 1, (c, i) => newCard = c.cards[i], c => c.isUnit(), false, false);
			}
			if (newCard) await newCard.autoplay(card.holder.grave);
		},
		weight: (card, ai, max, data) => ai.weightMedic(data, 0, card.holder)
	},
	anna_henrietta_grace: {
		description: "Отменяет способность «Приманка» на один раунд.",
		activated: async card => {
			game.decoyCancelled = true;
			await ui.notification("toussaint-decoy-cancelled", 1200);
			game.roundStart.push(async () => {
				game.decoyCancelled = false;
				return true;
			});
		},
		weight: (card) => game.decoyCancelled ? 0 : 10
	},
	meve_princess: {
		description: "Если у противника общая сила в одном ряду составляет 10 или более, уничтожьте самую сильную карту (карты) в этом ряду (влияет только на сторону противника).",
		activated: async (card, player) => {
			player.endTurnAfterAbilityUse = false;
			ui.showPreviewVisuals(card);
			ui.enablePlayer(true);
			if (!(player.controller instanceof ControllerAI)) ui.setSelectable(card, true);
		},
		weight: (card, ai, max) => {
			return Math.max(ai.weightScorchRow(card, max, "close"), ai.weightScorchRow(card, max, "ranged"), ai.weightScorchRow(card, max, "siege"));
		}
	},
	shield_c: {
		name: "Щит ближнего боя",
		description: "Защищает отряды в ряду ближнего боя от всех способностей, кроме эффектов погоды.",
		weight: (card) => 20
	},
	shield_r: {
		name: "Щит дальнего боя",
		description: "Защищает отряды в ряду дальнего боя от всех способностей, кроме эффектов погоды.",
		weight: (card) => 20
	},
	shield_s: {
		name: "Осадный щит",
		description: "Защищает отряды в осадном ряду от всех способностей, кроме эффектов погоды.",
		weight: (card) => 20
	},
	meve_white_queen: {
		description: "Все карты медиков могут выбирать две карты отрядов из сброса (влияет на обоих игроков).",
		gameStart: () => game.medicCount = 2
	},
	carlo_varese: {
		description: "Если у противника общая сила в одном ряду составляет 10 или более, уничтожьте самую сильную карту (карты) в этом ряду (влияет только на сторону противника).",
		activated: async (card, player) => {
			player.endTurnAfterAbilityUse = false;
			ui.showPreviewVisuals(card);
			ui.enablePlayer(true);
			if (!(player.controller instanceof ControllerAI)) ui.setSelectable(card, true);
		},
		weight: (card, ai, max) => {
			return Math.max(ai.weightScorchRow(card, max, "close"), ai.weightScorchRow(card, max, "ranged"), ai.weightScorchRow(card, max, "siege"));
		}
	},
	francis_bedlam: {
		description: "Отправляет все карты отрядов-шпионов на кладбище той стороны, на которой они находятся.",
		activated: async (card, player) => {
			let op_spies = card.holder.opponent().getAllRowCards().filter(c => c.isUnit() && c.abilities.includes("spy"));
			let me_spies = card.holder.getAllRowCards().filter(c => c.isUnit() && c.abilities.includes("spy"));
			await op_spies.map(async c => await board.toGrave(c, c.currentLocation));
			await me_spies.map(async c => await board.toGrave(c, c.currentLocation));
		},
		weight: (card, ai, max) => {
			let op_spies = card.holder.opponent().getAllRowCards().filter(c => c.isUnit() && c.abilities.includes("spy")).reduce((a,c) => a + c.power,0);
			let me_spies = card.holder.getAllRowCards().filter(c => c.isUnit() && c.abilities.includes("spy")).reduce((a, c) => a + c.power,0);
			return Math.max(0, op_spies - me_spies);
		}
	},
	cyprian_wiley: {
		description: "Захватывает отряд(ы) с наименьшей силой в ряду ближнего боя противника.",
		activated: async card => {
			let opCloseRow = board.getRow(card, "close", card.holder.opponent());
			let meCloseRow = board.getRow(card, "close", card.holder);
			if (opCloseRow.isShielded()) return;
			let units = opCloseRow.minUnits();
			if (units.length === 0) return;
			await Promise.all(units.map(async c => await c.animate("seize")));
			units.forEach(async c => {
				c.holder = card.holder;
				await board.moveToNoEffects(c, meCloseRow, opCloseRow);
			});
		},
		weight: (card) => {
			if (card.holder.opponent().getAllRows()[0].isShielded()) return 0;
			return card.holder.opponent().getAllRows()[0].minUnits().reduce((a, c) => a + c.power, 0) * 2
		}
	},
	gudrun_bjornsdottir: {
		description: "Призвать команду Флиндра.",
		activated: async (card, player) => {
			let new_card = new Card("sy_flyndr_crew", card_dict["sy_flyndr_crew"], player);
			await board.addCardToRow(new_card, new_card.row, card.holder);
		},
		weight: (card, ai, max) => {
			return card.holder.getAllRows()[0].cards.length + Number(card_dict["sy_flyndr_crew"]["strength"]);
		}
	},
	cyrus_hemmelfart: {
		description: "Разыграйте карту «Димеритиевые оковы» в любом ряду противника.",
		activated: async (card, player) => {
			player.endTurnAfterAbilityUse = false;
			ui.showPreviewVisuals(card);
			ui.enablePlayer(true);
			if (!(player.controller instanceof ControllerAI)) ui.setSelectable(card, true);
		},
		weight: (card) => 20
	},
	azar_javed: {
		description: "Уничтожает самую слабую карту героя противника (максимум 1 карту).",
		activated: async (card, player) => {
			let heroes = player.opponent().getAllRowCards().filter(c => c.hero);
			if (heroes.length === 0) return;
			let target = heroes.sort((a, b) => a.power - b.power)[0];
			await target.animate("scorch", true, false);
			await board.toGrave(target, target.currentLocation);
		},
		weight: (card, ai, max) => {
			let heroes = card.holder.opponent().getAllRowCards().filter(c => c.hero);
			if (heroes.length === 0) return 0;
			return heroes.sort((a, b) => a.power - b.power)[0].power;
		}
	},
	bank: {
		name: "Банк",
		description: "Возьмите карту из вашей колоды.",
		activated: async card => {
			card.holder.deck.draw(card.holder.hand);
			await board.toGrave(card, card.holder.hand);
		},
		weight: (card) => 20
	},
	witch_hunt: {
		name: "Охота на ведьм",
		description: "Уничтожает самый слабый отряд (отряды) в противоположном ряду.",
		placed: async card => {
			let row = card.currentLocation.getOppositeRow();
			if (row.isShielded() || game.scorchCancelled) return;
			let units = row.minUnits();
			await Promise.all(units.map(async c => await c.animate("scorch", true, false)));
			await Promise.all(units.map(async c => await board.toGrave(c, row)));
		}
	},
	zerrikanterment: {
		description: "Увеличение от прихожан удваивается.",
		gameStart: () => game.whorshipBoost *= 2
	},
	baal_zebuth: {
		description: "Выберите 2 карты из сброса противника и замешайте их обратно в его/её колоду.",
		activated: async (card) => {
			let grave = card.holder.opponent().grave;
			if (card.holder.controller instanceof ControllerAI) {
				let cards = grave.findCardsRandom(false,2);
				await Promise.all(cards.map(async c => await board.toDeck(c, c.holder.grave)));
				return;
			} else {
				try {
					Carousel.curr.exit();
				} catch (err) {}
			}
			await ui.queueCarousel(grave, 2, (c, i) => board.toDeck(c.cards[i], c), () => true);
		},
		weight: (card) => {
			if (card.holder.opponent().grave.cards.length < 5) return 0;
			else return 20;
		}
	},
	rarog: {
		description: "Возьмите случайную карту из сброса в руку (любую карту), а затем замешайте остальные обратно в колоду.",
		activated: async (card) => {
			if (card.holder.grave.cards.length === 0) return;
			let grave = card.holder.grave;
			let c = grave.findCardsRandom(false, 1)[0];
			await board.toHand(c, c.holder.grave);
			Promise.all(card.holder.grave.cards.map(c => board.toDeck(c, card.holder.grave)));
		},
		weight: (card) => {
			let medics = card.holder.hand.cards.filter(c => c.abilities.includes("medic"));
			if (medics.length > 0 || card.holder.grave.cards.length == 0) return 0;
			else return 15;
		}
	},
	whorshipper: {
		name: "Прихожанин",
		description: "Увеличивает на 1 силу всех почитаемых отрядов на вашей стороне поля.",
		placed: async card => {
			if (card.isLocked()) return;
			card.holder.effects["whorshippers"]++;
		},
		removed: async card => {
			if (card.isLocked()) return;
			card.holder.effects["whorshippers"]--;
		},
		weight: (card) => {
			let wcards = card.holder.getAllRowCards().filter(c => c.abilities.includes("whorshipped"));
			return wcards.length * game.whorshipBoost;
		}
	},
	whorshipped: {
		name: "Почитаемый",
		description: "Получает +1 к силе от каждого прихожанина на вашей стороне поля.",
	},
	inspire: {
		name: "Вдохновение",
		description: "Все отряды со способностью «Вдохновение» получают наивысшую базовую силу среди отрядов с «Вдохновением» на вашей стороне поля. По-прежнему подвержены влиянию погоды.",
	},
};

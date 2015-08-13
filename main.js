
/**
 * calendard 0.3.0
 * Licensed under GPLv3
 * Written for #priyom on freenode (priyom.org) by Tomáš Hetmer.
 * With additions by danix111, MilesPrower, linkfanel, L0j1k.
 */

var ivo = (function() {
	"use strict";

	// core
	var https = require('https');
	// local
	var config = require('./config.js');
	// third party
	var irc = require('irc');
	var moment = require('moment');
	var colors = config.color ? require('irc-colors') : null;

	// event timer aggregator. allows multiple events with timers ending at the
	// same time to notify the channel in a single message instead of individually.
	var $aggregator = (function() {
		var events = [];
		var open = true;
		var fire = function() {
			$func.events.sayNext();
		};
		var flush = function() {
			events = [];
		};
		var push = function( evt ) {
			if (open) {
				open = false;
				setTimeout(function() {
					fire();
					open = true;
					flush();
				}, 2500);
			}
			events.push(evt);
		};
		return {
			flush: flush,
			push: push
		};
	})();

	// data storage object
	var $data = {
		data: (process.env.calendard_data === 'mock' ? 'mock' : 'google'),
		dataReady: false,
		dev: (process.env.calendard === 'dev'),
		events: [],
		hasRoom: false,
		hasEvents: false,
		isReady: false,
		regex: {
			morse: /^M\d+[a-z]?$/,
			voice: /^[EGSV]\d+[a-z]?$/
		},
		room: process.env.calendard === 'dev' ? config.dev.room : config.room,
		station: {
			digital: [ 'FSK 200/500', 'FSK 200/1000', 'XPA', 'XPA2', 'POL FSK', 'HM01' ]
		},
		timers: {
			eventCheck: true,
			pong: null
		},
		types: []
	};

	// log convenience function (console.log is so 2005)
	var $log = (function() {
		var debug = function( data ) {
			return console.log($func.util.time()+' [DBUG] '+data);
		};
		var error = function( data ) {
			throw new Error($func.util.time()+' [EROR] '+data);
		};
		var log = function( data ) {
			return console.log($func.util.time()+' [LOG ] '+data);
		};
		return {
			debug: debug,
			error: error,
			log: log
		};
	})();

	var $client = new irc.Client($data.dev ? config.dev.server : config.server, $data.dev ? config.dev.botName : config.botName, {
		userName: $data.dev ? config.dev.userName : config.userName,
		realName: $data.dev ? config.dev.realName : config.realName,
		port: $data.dev ? config.dev.port : config.port,
		password: $data.dev ? config.dev.password : config.password,
		sasl: true,
		showErrors: true,
		autoConnect: false,
		retryDelay: 4000,
		retryCount: 1000,
		secure: $data.dev ? config.dev.tls : config.tls
	});

	// function storage object
	var $func = {
		__dev: {
			getEvents: function( num, special ) {
				// this function generates random events for testing, simulating http getCalendarData()
				// special {boolean} will return array of events all having the same event date +60s, for testing event time collision handler
				function _getEvent( time ) {
					return {
						start: {
							dateTime: new Date(Math.floor(new Date().getTime()+time*1000))
						},
						summary: (['M12','HM01','S06'][Math.floor(Math.random()*3)])+' '+Math.floor(Math.random()*15000)+' kHz '+(['USB/AM','USB','LSB','AM','CW','MCW'][Math.floor(Math.random()*6)])
					};
				};
				function compare( a, b ) {
					if (a.startTime < b.startTime) return -1;
					if (a.startTime > b.startTime) return 1;
					return 0;
				};
				var num = $func.util.type(num) !== 'number' ? 6 : num;
				var special = $func.util.type(special) !== 'boolean' ? false : special;
				var events = [];
				for (var i=0,len=num; i<len; i++, events.push(_getEvent( (special ? 120 : (Math.floor(Math.random()*5)+2)*60) )));
				return events.sort(compare);
			}
		},
		announcements: {
			check: function() {
				// check if next timer is within 60 seconds, announce if it is
				$func.events.update();
				if ($data.timers.eventCheck) setTimeout($func.announcements.check, 60000);
			}
		},
		client: {
			getCalendarData: function() {
				$log.log('asking Google for data...');
				// set date for request
				$data.calendarUrl = "https://www.googleapis.com/calendar/v3/calendars/" +
					config.calendarId +
					"@group.calendar.google.com/events?orderBy=startTime&singleEvents=true&timeMin=" +
					new Date().toISOString() +
					"&fields=items(start%2Csummary)%2Csummary&key=" +
					config.apiKey +
					"&maxResults=" +
					config.maxResults;
				https.get($data.calendarUrl, function (res) {
					$log.log('  - http request got statusCode: ' + res.statusCode);

					var data = '';

					res.on('data', function(chunk) {
						data += chunk;
					});
					res.on('end', function () {
						var obj = $data.data === 'mock' ? {
							//
							// STUBS for development since we don't have the API key
							//
							// if you want events with the same trigger time, add boolean true parameter to getEvents()
							items: $func.__dev.getEvents(6)
						} : JSON.parse(data);
						if (typeof(obj) !== 'object' || $func.util.type(obj.items) !== 'array') $log.error('$func.client.getCalendarData(): improper return object. cannot proceed ['+JSON.stringify(obj)+']');
						$func.client.onHttpReturn(obj.items);
					});
				}).on('error', function (e) {
					$log.error('[!] HTTP CLIENT ERROR: '+e.message);
				});
			},
			onHttpReturn: function( events ) {
				function compareTimes( a, b ) {
					if (a.start.dateTime < b.start.dateTime) return -1;
					if (a.start.dateTime > b.start.dateTime) return 1;
					return 0;
				};
				$log.log('sorting events...');
				events.sort(compareTimes);

				// get rid of events which have already occurred
				// (we have to do this because we stupidly operate on two sets of completely different event elements)
				var newEvents = [];
				var now = Math.floor(new Date().getTime()/1000);
				events.forEach(function(el) {
					if (Math.floor(new Date(el.start.dateTime).getTime()/1000) > now) newEvents.push(el);
				});
				events = newEvents;

				$log.log('number of events found: ' + events.length);
				$log.log('time of first event: ' + events[0].start.dateTime);
				// flush event cache
				$log.log('flushing old event cache...');
				$data.events = [];
				// flush old timers so we don't have multiple messages
				$log.log('flushing old timers...');
				$func.events.flushTimers();

				events.forEach(function(evt) {
					var timer = new Date(evt.start.dateTime).getTime() - 60000 - new Date().getTime();
					// if the event will occur in less than sixty seconds, send message now
					if (timer < 60000) timer = 0;
					var event = {
						eventDate: new Date(evt.start.dateTime),
						title: evt.summary,
						frequency: $func.extract.frequency(evt.summary),
						mode: $func.extract.mode(evt.summary),
						timer: null
					};
					event.timer = setTimeout(function() {
						if ($data.hasRoom) $aggregator.push(event);
					}, timer);
					$data.events.push(event);
				});
				if (!$data.dataReady) {
					if ($data.hasRoom) $client.say($data.room, 'Done loading events...');
					$data.dataReady = true;
				}
				if ($data.hasRoom) $func.client.onReady();
				return true;
			},
			onReady: function() {
				$log.log('system ready!');
				$data.isReady = true;
			}
		},
		events: {
			flushTimers: function() {
				$data.events.forEach(function(el) {
					clearTimeout(el.timer);
				});
			},
			getNextDate: function() {
				return $data.events[0].eventDate;
			},
			getNextEvent: function() {
				// Based on original events code written by foo (UTwente-Usability/events.js)
				var nextEvents = [];
				var lastTime = null;

				// get a list of the next events which share the same "next event time"
				$data.events.forEach(function(evt) {
					if (lastTime === null || lastTime === evt.eventDate.toISOString()) {
						lastTime = evt.eventDate.toISOString();
						nextEvents.push(evt);
						return true;
					}
				});

				// this really shouldn't happen, but sure, just in case...
				if (nextEvents.length === 0) return $func.client.getCalendarData(), '';

				var first = moment(nextEvents[0].eventDate);
				var time = first.utc().format('HH:mm');
				var header = (config.color ? colors.bold(time) : time) + " " + first.fromNow() + " ";

				var formattedEvents = [];

				nextEvents.forEach(function(evt) {
					var format = $func.format.event(evt.title);
					// Don't give a link for "Target", as "Target" implies that the TX can NOT be heard on UTwente. (most of the time at least)
					if (typeof(evt.frequency) !== 'undefined' && evt.frequency.length > 3 && evt.title.indexOf('Target') === -1) {
						var freq = evt.frequency;
						var mode = '';
						switch (evt.mode) {
							case 'CW':
								// This makes the CW stations +1000Hz on USB.
								freq = freq-1;
							case 'LSB':
								// NOTE: we're falling through from LSB into AM!
							case 'AM':
								// Especially for M08a
								// For HM01 too... veryu
								mode = evt.mode.toLowerCase();
								break;
						}
						format += ' http://freq.ml/' + freq + mode;
					}
					formattedEvents.push(format);
				});
				return (header + formattedEvents.join(" • "));
			},
			sayNext: function() {
				if ($data.hasRoom) return $client.say($data.room, $func.events.getNextEvent());
			},
			update: function() {
				var newEvents = [];
				var now = Math.floor(new Date().getTime()/1000);
				$data.events.forEach(function(el) {
					if (Math.floor(new Date(el.eventDate).getTime()/1000) > now) newEvents.push(el);
				});
				$data.events = newEvents;
				// get more events!
				if ($data.events.length < 3) return $func.client.getCalendarData(), false;
			}
		},
		extract: {
			frequency: function( textToMatch ) {
				// Without this the frequency marked as "last used" is given as a link.
				// Which is misleading as fuck.
				if ($func.util.type(textToMatch) !== 'string') $log.error('$func.extract.frequency(): incorrect parameters!');
				return textToMatch.indexOf("Search") > -1 ? true : textToMatch.match(/(\d+) ?kHz/i)[1];
			},
			mode: function( textToMatch ) {
				if ($func.util.type(textToMatch) !== 'string') $log.error('$func.extract.mode(): incorrect parameters!');
				var result = textToMatch.match(/AM|USB\/AM|USB|LSB|CW|MCW/i);
				return result != null && result.length && result.length > 0 ? result[1] : '';
			}
		},
		format: {
			station: function( match, name, rest ) {
				if (!config.color) return match;
				var cname;
				if ($data.station.digital.indexOf(name) > -1) {
					cname = colors.red(name);
				} else if ($data.regex.morse.test(name)) {
					cname = colors.purple(name);
				} else if ($data.regex.voice.test(name)) {
					cname = colors.green(name);
				} else {
					cname = colors.brown(name);
				}

				return (cname + " " + rest);
			},
			search: function( match, search ) {
				return config.color ? (" " + colors.bold(search) + " ") : match;
			},
			frequency: function( freq ) {
				return config.color ? colors.olive(freq) : freq;
			},
			event: function( title ) {
				if (!config.color) return title;
				title = title.replace(/^([\w /]+?) (\d+ ?kHz|Search)/i, $func.format.station);
				title = title.replace(/ (Search) /i, $func.format.search);
				title = title.replace(/\d+ ?[kK][hH][zZ]( [A-Z][A-Z/]+)?/g, $func.format.frequency);
				return title;
			}
		},
		stations: {
			link: function( stn ) {
				// grab the first element from the given arguments list
				if (typeof(stn) !== 'string') return false;

				// avoid pissing people off, veryu
				var station = typeof(stn.toLowerCase) === 'function' && stn.toLowerCase();

				var milBase = 'http://priyom.org/military-stations/';
				var diploBase = 'http://priyom.org/diplomatic-stations/';
				var numberBase = 'http://priyom.org/number-stations/';

				// mil/diplo/digi aliases
				switch (station) {
					case 'katok65':
						station = 'katok-65';
						break;
					case 'plovets41':
						station = 'plovets-41';
						break;
					case 'hf-gcs':
						station = 'hfgcs';
						break;
					case 'mazielka':
						station = 'x06';
						break;
					case 'polfsk':
						station = 'pol-fsk';
						break;
					case '200/1000':
						station = 'fsk-2001000';
						break;
					case '200/500':
						station = 'fsk-200500';
						break;
				}

				// yep mil/diplo/digi stuff is special
				switch (station) {
					case 'buzzer':
					case 's28':
						return milBase + 'russia/the-buzzer';
					case 'pip':
					case 's30':
						return milBase + 'russia/the-pip';
					case 'wheel':
					case 's32':
						return milBase + 'russia/the-squeaky-wheel';
					case 's5292':
					case 's4790':
					case 's5426':
					case 'katok-65':
					case 'plovets-41':
					case 'm32':
						return milBase + 'russia/' + station;
					case 'mxi':
					case 'cluster':
						return milBase + 'russia/naval-markers';
					case 'monolith':
						return milBase + 'russia/monolyth-messages-description';
					case 'alphabet':
						return milBase + 'russia/russian-phonetic-alphabet-and-numbers';
					case 'hfgcs':
						return milBase + 'united-states/' + station;
					case 'vc01':
						return milBase + 'china/chinese-robot';
					case 'm51':
						return milBase + 'france/' + station;
					case 'xsl':
						return milBase + 'japan/slot-machine';
					case 'x06':
					case 'x06a':
					case 'x06b':
					case 'x06c':
						return diploBase + 'russia/' + station;
					case 'fsk-2001000':
					case 'fsk-200500':
					case 'dp01': // fo, e!
					case 'hm01':
					case 'xpa':
					case 'xpa2':
					case 'sk01':
					case 'xp':
					case 'pol-fsk':
						return numberBase + 'digital/' + station;
					case 'sked':
						return numberBase + 'station-schedule';
				}

				// the rest should be ok to do this way
				var languages = {
					e: 'english',
					g: 'german',
					s: 'slavic',
					v: 'other',
					m: 'morse',
				};
				var language = languages[station[0]];
				if (language) return numberBase + language + '/' + station;

				return 'u wot m8';
			}
		},
		util: {
			time: function() {
				return new Date().toJSON();
			},
			type: function( thing ) {
				if (thing == null) return thing + '';
				return typeof(thing) === 'object' || typeof(thing) === 'function' ? $data.types[Object.prototype.toString.call(thing)] || 'object' : typeof(thing);
			}
		}
	};

	var init = (function() {
		$log.log('initializing ivobot...');
		// populate granular types array for better type checking
		('Boolean Number String Function Array Date RegExp Object Error'.split(' ').forEach(function(name, i) {
			$data.types['[object ' + name + ']'] = name.toLowerCase();
		}));
		$log.log('running in state: ' + ($data.dev ? 'dev' : 'prod'));
		$log.log('using data of type: ' + $data.data);
	})();

	var main = function() {
		// connecting client to irc...
		$log.log('connecting to irc (channel '+$data.room+')...')
		$client.connect(5, function (input) {
			$log.log('calendard on server');

			$client.join($data.room, function (input) {
				$data.hasRoom = true;

				$log.log('channel connection is ready!');

				$data.timers.pong = setInterval(function () {
					$client.send('PONG', 'empty');
				}, 2 * 60 * 1000);

				if ($data.hasRoom) setTimeout($func.announcements.check, 5000);
			});
		});
		$client.addListener('message' + $data.room, function (from, to, message) {
			var args = message.args[1].split(' ');
			var cmd = args[0];
			switch(cmd) {
				case '!next':
				case '!n':
					$log.log('received next command from ' + from);
					return $data.dataReady ? $func.events.sayNext() : $client.say($data.room, "I'm still retrieving the newest events...");
				case '!stream':
					$client.say($data.room, 'http://stream.priyom.org:8000/buzzer.ogg.m3u');
					break;
				case '!link':
					$log.log('received link command from ' + from);
					if (args.length > 1) $client.say($data.room, $func.stations.link(args[1]));
					break;
				case '!listen':
					$client.say($data.room, 'http://websdr.ewi.utwente.nl:8901/');
					break;
				case '!reload':
					$client.say($data.room, 'Reloading...');
					$data.dataReady = false;
					$log.log('refreshing events list...');
					$func.client.getCalendarData();
					break;
				case '!why':
					$client.say($data.room, 'The Buzzer is not audible at this time of the day due to HF propagation characteristics. Try again later in the local evening.');
					break;
				case '!new':
					$client.say($data.room, 'You can visit our site at http://priyom.org where we have a good read regarding any and all information about logged numbers stations.');
					break;
				case '!rules':
					$client.say($data.room, 'http://priyom.org/about/irc-rules');
					break;
				case '!rivet':
					$client.say($data.room, 'http://www.apul64.dsl.pipex.com/enigma2000/rivet/index.html');
					break;
				case '!utc':
					$client.say($data.room, (new Date()).toUTCString());
					break;
			}
		});
		$client.addListener('error', function (message) {
			$log.error('[!] IRC CLIENT ERROR: ', message);
		});
		$func.client.getCalendarData();
	};

	// if we're called with require(), it's test tiem! otherwise fire it up
	if (require.main === module) {
		return main();
	} else {
		return {
			__test: {
				func: $func
			}
		}
	}
})();

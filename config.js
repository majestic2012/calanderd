

var config = module.exports = {
	// irc config
	room: '#priyom',
	server: 'chat.freenode.net',
	botName: 'IvoSchwarz',
	userName: 'ivo',
	realName: 'Ivo Schwarz',
	password: '',
	port: 7000,
	tls: true,
	color: true,

	// calendar settings
	apiKey: '',
	// this is in your iCal, html, etc. URLs
	calendarId: 'ul6joarfkgroeho84vpieeaakk',

	// announce before ...
	announceEarly: 1 * 60000, // ms

	// calendar limits
	maxResults: 150 // at least 2
};
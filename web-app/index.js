const os = require('os')
const dns = require('dns').promises
const { program: optionparser } = require('commander')
const { Kafka } = require('kafkajs')
const mysqlx = require('@mysql/xdevapi');
const MemcachePlus = require('memcache-plus');
const express = require('express')

const app = express()
const cacheTimeSecs = 15
const numberOfMovies = 30


// Command Line Options

let options = optionparser
	.storeOptionsAsProperties(true)
	// Web server
	.option('--port <port>', "Web server port", 3000)
	// Kafka options
	.option('--kafka-broker <host:port>', "Kafka bootstrap host:port", "my-cluster-kafka-bootstrap:9092")
	.option('--kafka-topic-tracking <topic>', "Kafka topic to tracking data send to", "tracking-data")
	.option('--kafka-client-id < id > ', "Kafka client ID", "tracker-" + Math.floor(Math.random() * 100000))
	// Memcached options
	.option('--memcached-hostname <hostname>', 'Memcached hostname (may resolve to multiple IPs)', 'my-memcached-service')
	.option('--memcached-port <port>', 'Memcached port', 11211)
	.option('--memcached-update-interval <ms>', 'Interval to query DNS for memcached IPs', 5000)
	// Database options
	.option('--mysql-host <host>', 'MySQL host', 'my-app-mysql-service')
	.option('--mysql-port <port>', 'MySQL port', 33060)
	.option('--mysql-schema <db>', 'MySQL Schema/database', 'popular')
	.option('--mysql-username <username>', 'MySQL username', 'root')
	.option('--mysql-password <password>', 'MySQL password', 'mysecretpw')
	// Misc
	.addHelpCommand()
	.parse()
	.opts()


// Database Configuration


const dbConfig = {
	host: options.mysqlHost,
	port: options.mysqlPort,
	user: options.mysqlUsername,
	password: options.mysqlPassword,
	schema: options.mysqlSchema
};

async function executeQuery(query, data) {
	let session = await mysqlx.getSession(dbConfig);
	return await session.sql(query, data).bind(data).execute()
}

// Memcache Configuration


//Connect to the memcached instances
let memcached = null
let memcachedServers = []

async function getMemcachedServersFromDns() {
	try {
		// Query all IP addresses for this hostname
		let queryResult = await dns.lookup(options.memcachedHostname, { all: true })

		// Create IP:Port mappings
		let servers = queryResult.map(el => el.address + ":" + options.memcachedPort)

		// Check if the list of servers has changed
		// and only create a new object if the server list has changed
		if (memcachedServers.sort().toString() !== servers.sort().toString()) {
			console.log("Updated memcached server list to ", servers)
			memcachedServers = servers

			//Disconnect an existing client
			if (memcached)
				await memcached.disconnect()

			memcached = new MemcachePlus(memcachedServers);
		}
	} catch (e) {
		console.log("Unable to get memcache servers", e)
	}
}

//Initially try to connect to the memcached servers, then each 5s update the list
getMemcachedServersFromDns()
setInterval(() => getMemcachedServersFromDns(), options.memcachedUpdateInterval)

//Get data from cache if a cache exists yet
async function getFromCache(key) {
	if (!memcached) {
		console.log(`No memcached instance available, memcachedServers = ${memcachedServers}`)
		return null;
	}
	return await memcached.get(key);
}


// Kafka Configuration

// Kafka connection
const kafka = new Kafka({
	clientId: options.kafkaClientId,
	brokers: [options.kafkaBroker],
	retry: {
		retries: 0
	}
})

const producer = kafka.producer()
// End

// Send tracking message to Kafka
async function sendTrackingMessage(data) {
	//Ensure the producer is connected
	await producer.connect()

	//Send message
	await producer.send({
		topic: options.kafkaTopicTracking,
		messages: [
			{ value: JSON.stringify(data) }
		]
	})
}
// End

// HTML helper to send a response to the client


function sendResponse(res, html, cachedResult) {
	res.send(`<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title style="algin:center">Movie Recommendation System</title>
			<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/mini.css/3.0.1/mini-default.min.css">
			<style>
				.container {
					display: flex;
					flex-direction: row;
					flex-wrap: wrap;
					justify-content: space-evenly;
					align-items: center;
					align-content: center;
					width: 100%;
					height: auto;	
			  	}
				.item {
					flex-grow: 1;
				}
				.top_smth_container{
					display: flex;
					flex-direction: row;
					justify-content: space-evenly;
					align-items: flex-start;
					align-content: flex-start;

				}
				.top_item{
					flex-grow: 1;
				}
				h1{
					font-size: 6vw !important;
					color:#dc143c;
				}
				h2{
					font-size: 3.5vw !important;
				}
			</style
		</head>
		<body style="background-color:#051126">
			<div>
				<h1>Movie Recommendation System</h1>
			<hr>
			<br>
			</div>
			<div>
				${html}
			</div>
			<br>
			<div>
				<hr>
				<h2 style="color:white;">Information about the generated page</h4>
			</div>
			<br>
			<div>
			
				<ul>
					<li style="color:white;">Server: ${os.hostname()}</li>
					<li style="color:white;">Date: ${new Date()}</li>
					<li style="color:white;">Using ${memcachedServers.length} memcached Servers: ${memcachedServers}</li>
					<li style="color:white;">Cached result: ${cachedResult}</li>
					<li style="color:white;">Powered by: Unknown</li> 
				</ul>
			
			</div>
		</body>
	</html>
	`)
}



// Start page
// Get list of movies (from cache or db)
async function getMovies() {
	const key = 'movies'
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, cachedata = ${cachedata}`)
		return { result: cachedata, cached: true }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)
		let executeResult = await executeQuery("SELECT movie, genre, linksource FROM movies", [])
		let data = executeResult.fetchAll()
					


		if (data) {
			let result = data.map( row => ({movie: row[0], genre: row[1], linksource: row[2]}))
			console.log(`Got result=${result}, storing in cache`)
			if (memcached)
				await memcached.set(key, result, cacheTimeSecs);
			return { result, cached: false }
		} else {
			throw "No movies data found"
		}
	}
}


// Get popular movies
// Function which selects the movies which have been selected the most by the user
async function getpopular(maxCount) {
	const query = "SELECT movie, count FROM popular ORDER BY count DESC LIMIT ?"
	return (await executeQuery(query, [maxCount]))
		.fetchAll()
		// Mapping Function
		.map(row => ({ movie: row[0], count: row[1] }))
}


// Get popular genre 
// Query selects the genres with the most voted count
async function getpopular_genre(maxCount) {
	const query_genre = "SELECT m.genre, SUM(p.count) FROM movies m, popular p WHERE m.movie = p.movie GROUP BY m.genre ORDER BY SUM(p.count) DESC LIMIT ?"  
	return (await executeQuery(query_genre, [maxCount]))
		.fetchAll()
		// Mapping Function
		.map(row => ({ genre: row[0], count: row[1] }))
}

// Return HTML for start page
app.get("/", (req, res) => {
	// Top 10 Movies
	const topX = 10;
	// Top 3 Genres
	const topD = 3;
	Promise.all([getMovies(), getpopular(topX), getpopular_genre(topD)]).then(values => {
		const movies = values[0]
		const popular = values[1]
		const popular_genre = values[2]

		// Display all movie names from movie database to click on them
		const moviesHtml = movies.result
			.map(m => `	<div class="item">
							<a href='movies/${m.movie} '>
							<img src="${m.linksource}" alt="${m.movie.replaceAll('_', ' ')}" style="width:15vw;height:"></img>
							</a>
						</div>`)
			.join("\n")
		// Display the movies from the popular database
		const popularHtmlmovie = popular
			.map(pop => `<li style="color:white; font-size:1.6vw;"> <a href='movies/${pop.movie}'>${pop.movie.replaceAll('_', ' ')}</a> (${pop.count} views) </li>`)
			.join("\n")

		// Show the most clicked genres from the popular database
		const popularHtmlgenre = popular_genre
			.map(pop_genre => `<li style="color:white; font-size:1.6vw;"> <a href='genre/${pop_genre.genre}'>${pop_genre.genre.replaceAll('_', ' ')}</a> (${pop_genre.count} views) </li>`)
			.join("\n")

		// HTML code to display moviesHtml, popularHtmlmovie and popularHtmlgenre
		const html = `		
			<div class="top_smth_container">
				<div class="top_item">
					<h2 style="color:white;">Top ${topX} Movies</h2>
					<ol style="margin-left: 4vw;"> ${popularHtmlmovie} </ol> 
				</div>
				<div class="top_item">
					<h2 style="color:white;">Top ${topD} Genres</h2>
					<ol style="margin-left: 4vw;"> ${popularHtmlgenre} </ol> 
				</div>
			</div>
			<br>
			<h2 style="color:white;">All Movies</h2>
			<div class="container">${moviesHtml}</div>
		`
		sendResponse(res, html, movies.cached)
	})
})


// Get a specific movie (from cache or DB)
async function getMovie(movie) {
	const query = "SELECT movie, genre, language, image, linksource FROM movies WHERE movie = ?"
	const key = 'movie_' + movie
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, cachedata = ${cachedata}`)
		return { ...cachedata, cached: true }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let data = (await executeQuery(query, [movie])).fetchOne()
		if (data) {
			let result = { movie: data[0], genre: data[1], language: data[2], image: data[3], linksource: data[4]}
			console.log(`Got result=${result}, storing in cache`)
			if (memcached)
				await memcached.set(key, result, cacheTimeSecs);
			return { ...result, cached: false }
		} else {
			throw "No data found for this movie"
		}
	}
}

app.get("/movies/:movie", (req, res) => {
	let movie = req.params["movie"]

	// Send the tracking message to Kafka
	sendTrackingMessage({
		movie,
		timestamp: Math.floor(new Date() / 1000)
	}).then(() => console.log("Sent to kafka"))
		.catch(e => console.log("Error sending to kafka", e))

	// Send reply to browser
	getMovie(movie).then(data => {
		sendResponse(res, `
		<a href='/'>
			<h2>Back</h2>
		</a>
		<div>
			<div>
				<h2 style="color:white;">${data.movie.replaceAll('_', ' ')}</h2>
				<p style="color:white; font-size:1.6vw;">Genre: ${data.genre.replaceAll('_', ' ')}</p>
				<p style="color:white; font-size:1.6vw;">Original Language: ${data.language.replaceAll('_', ' ')}</p>
			<img src="${data.linksource}" alt="${data.movie.replaceAll('_', ' ')}" style="width:40vw;"></img>
			</div>
		</div>`,
		
		
			data.cached
		)
	}).catch(err => {
		sendResponse(res, `<h1 style="color:white;">Error</h1><p>${err}</p>`, false)
	})
});



// Get a all movies for a specific genre (from cache or DB)

async function getGenre(genre) {
	const query = "SELECT movie, linksource FROM movies WHERE genre = ?"
	const key = 'movie_' + genre
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, cachedata = ${cachedata}`)
		return { ...cachedata, cached: true }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let data = (await executeQuery(query, [genre])).fetchAll()
		
		if (data) {
			let result = data.map( row => ({movie: row[0], linksource: row[1]}))
			/* console.log('---------------------------------------')
			console.log('Result:')
			console.log(Object.entries(result))
			console.log('---------------------------------------') */
			console.log(`Got result=${result}, storing in cache`)
			if (memcached)
				await memcached.set(key, result, cacheTimeSecs);
			return { ...result, cached: false }
		} else {
			/* console.log('---------------------------------------')
			console.log('Hallo Welt')
			console.log('---------------------------------------') */
			throw "No movies found for this genre"
		}
	}
}

app.get("/genre/:genre", (req, res) => {
	
	let genre = req.params["genre"]
	// Send reply to browser
	getGenre(genre).then(data => {
	const genredata = Object.values(data).slice(0, -1)
	console.log('---------------------------------------')
	console.log('genredata:')
	console.log(Object.entries(genredata))
	console.log('---------------------------------------')
	
	// Display all movie names from movie database to click on them
	const genremoviesHtml = genredata
		.map(g => `	
		<div class="item">
			<a href='/movies/${g.movie} '>
				<img src="${g.linksource}" alt="${g.movie}" style="width:15vw;height:"></img>
			</a>
		</div>`)
		.join("\n")
		
	// HTML code to display moviesHtml, popularHtmlmovie and popularHtmlgenre
	const genrehtml = `		
		<a href='/'>
			<h2> Back </h2>
		</a>
		<h2 style="color:white;">If <b>${genre}</b> is your favourite genre, you also should watch following movies:</h2>
		<div class="container"> ${genremoviesHtml} </div>`
		sendResponse(res, genrehtml, data.cached)
	}).catch(err => {
		sendResponse(res, `<h1 style="color:white;">Error</h1><p>${err}</p>`, false)
	})
	
	
	
});




// Get a genres movies (from cache or DB)
/* async function getGenre(movie) {
	const query = "SELECT movie, genre, language, image, linksource FROM movies WHERE genre = ?"

	if (cachedata) {
		console.log(`Cache hit for key=${key}, cachedata = ${cachedata}`)
		return { ...cachedata, cached: true }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let data = (await executeQuery(query, [movie])).fetchOne()
		if (data) {
			let result_genre = data.map( row => ({ movie: row[0], genre: row[1], language: row[2], image: row[3], linksource: row[4]}))
			return result_genre
		} else {
			throw "No movies for this genre"
		}
	}};	

// Genres page
app.get("/genre/:genre", (req, res) => {
	Promise.all([getGenre(movie)]).then(values => {
		const movies = values[0]

		const mapgenre = movies.result
			.map(data => `<img src="${data.linksource}" alt="${data.movie.replaceAll("_", " ")}" style="width:15vw;"></img>`)
			sendResponse(`
			<a href='/'>
					<h1>
						Back
					  </h1>
				</a>`,mapgenre)}
	)
}); */

// Main method
app.listen(options.port, function () {
	console.log("Node app is running at http://localhost:" + options.port)
});

var express = require('express'), app = express();
var redis = require('redis'), redisClient = redis.createClient();
var bodyParser = require('body-parser');
var async = require('async');
var fs = require('fs');
var Plates = require('plates');


var model = {
	fetch: function(keys, collection, callback){
		redisClient.keys(keys, function(err, rep){
			async.each(rep, function(key, callback){
				redisClient.hgetall(key, function(err, obj){
					collection.push(obj);
					if(!err)callback(null);
				});
			}, function(err){
				callback();
			});
		});
	},
	sru: {
		page:{
			title: 'Slippery Rock University Off-Campus Housing Directory'
		},
		apartmentCollection: [],
		apartmentKeys: 'apartments:pennsylvania:slippery_rock_university:*'
	},
	psu:{}
};

var schools = ['sru'];

var view = {
	base: (function(){ 
		return fs.readFileSync(__dirname + '/templates/home.html', 'utf8');
	})(),
	partial: (function(){
		return fs.readFileSync(__dirname + '/templates/partials/listing.html', 'utf8');
	})(),
	sru:'',
	psu:{},
	init:(function(){
		async.each(schools, function(school, callback){
			model.fetch(model[school].apartmentKeys, model[school].apartmentCollection, function(){
				var base = Plates.bind(view.base, model[school].page);
				var mapping = Plates.Map();
				mapping.class('listing_wrapper').append(Plates.bind(view.partial, model[school].apartmentCollection));
				view[school] = Plates.bind(base, {}, mapping);
				callback(null);
			});
		}, function(err){});
	})()
};

app.use(express.static('js'));
app.use(express.static('css'));
app.use(express.static('img'));
app.use(bodyParser.urlencoded({extended: true}));

app.get('/Slippery-Rock', function(req, res, next){
	res.send(view.sru);
});

app.get('/Penn-State', function(req, res, next){
	res.send(output);
});


app.get('/api', function(req, res, next){
	res.sendFile(__dirname + '/templates/api.html');
});

app.post('/api/apartments', function(req, res, next){
	var school = req.body.school.toLowerCase().split(' ').join('_') || "school",
	state = req.body.state.toLowerCase().split(' ').join('_') || "state",
	redid = req.body.state.redid || [parseInt(Date.now() / 100000), process.hrtime()[1]].join(".");
	
	var deserialize = function(arr, count){
		var itemArray = [];
		for(i=0; i<count; i++){
			if(arr[i] != ''){
				itemArray.push(arr[i]);
			}
		}
		return itemArray;
	};

	var writeData = {
		//
		////School Info
		//id, school, state
		id: req.body.id || '',
		school: req.body.school || '',
		state: req.body.state || '',
		
		//
		////Propety Info
		//pname, zip, address, phone, website, facebook, hours, manager, description, rating, available
		property: req.body.pname || '',
		zip: req.body.zip || '',
		address: req.body.address || '',
		phone: req.body.phone || '',
		website: req.body.website || '',
		facebook: req.body.facebook || '',
		hours: req.body.hours || '',
		manager: req.body.manager || '',
		description: req.body.description || '',
		rating: req.body.rating || '',
		available: req.body.available || "Call for Availability",

		//
		//Base Features
		//smoking, fios, cable, furnish, security, onsite, washer, storage, parking
		smoking: req.body.smoking || false,
		fios: req.body.fios || false,
		cable: req.body.cable || false,
		furnish: req.body.furnish || false,
		security: req.body.security || false,
		onsite: req.body.onsite || false,
		washer: req.body.washer || false,
		storage: req.body.storage || false,
		parking: req.body.parking || false,

		//
		//Additional Features
		//add 1-18
		adds: deserialize(add,18),

		//
		//Pet Policy
		//dog, cat, pet1-5
		dogs: req.body.dog || '0',
		cats: req.body.cat || '0',
		policy: deserialize(pet, 5), 

		//
		//Pricing
		//rentLow, rentHigh, deposit, bed1-4, bath1-4, price1-4, low1-4, high1-4, floorPic1-4
		rentLow: req.body.rentLow || '0',
		rentHigh: req.body.rentHigh ||'0',
		deposit: req.body.deposit || '0',
		beds: deserialize(bed, 4),
		baths: deserialize(bath, 4), 
		price: deserialize(price, 4),
		lows: deserialize(low, 4),
		highs: deserialize(high, 4), 
		floorPics: deserialize(pic, 4)
	};
	redisClient.HMSET("apartments:" + state + ":" + school + ":" + redid, writeData, function(error, response){
		if(error != null) res.send('failure');
		else{
		 res.send(writeData);
		 console.log("Successfully wrote to Redis : " + writeData);
		}
	});

});

app.listen(8080, function(){
	console.log('listening on 104.131.9.233:8080'); 
});

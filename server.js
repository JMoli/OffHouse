var express = require('express'), app = express();
var redis = require('redis'), redisClient = redis.createClient();
var bodyParser = require('body-parser');
var async = require('async');
var fs = require('fs');
var Plates = require('plates');


var model = {
	set: function(keys, collection, callback){
		redisClient.keys(keys, function(err, rep){
			console.log(rep);
			if(!err){
				async.each(rep, function(key, callback){
					console.log(rep);
					redisClient.hgetall(key, function(err, obj){
						collection.push(obj);
						if(!err)callback(null);
					});
				}, function(err){
					if(!err)callback();
				});
			}
		});
	},
	sru: {
		page:{
			title: 'Slippery Rock University Off-Campus Housing Directory'
		},
		collection: [],
		apartmentKeys: 'listings:slippery_rock_university:*'
	},
	psu:{},
	api:{
		schools: function(callback){
			redisClient.keys('schools:*', function(err, rep){
				if(!err) callback(rep);
			});
		}
	}
};

var schools = ['sru'];

var view = {
	home_base: (function(){ 
		return fs.readFileSync(__dirname + '/templates/home.html', 'utf8');
	})(),
	info_base: (function(){
		return fs.readFileSync(__dirname + '/templates/info.html', 'utf8');	
	})(),
	base_partial: (function(){
		return fs.readFileSync(__dirname + '/templates/partials/listing.html', 'utf8');
	})(),
	partials: {
		table: function(item){
			var on = '<i class="fi-check"></i>';
			var off = '<i class="fi-x"></i>';
			if(item == '0') return on;
			else return off;
		}
	},
	api:{
		property: (function(){
			return fs.readFileSync(__dirname + '/templates/api/property.html', 'utf8');
		})(),
		listing:(function(){
			return fs.readFileSync(__dirname + '/templates/api/listing.html', 'utf8');
		})(),
		schools_partial: function(callback){
			model.api.schools(function(schools){
				var partial = '';
				var pat = new RegExp(/(?:schools:)(\w*)/);
				async.each(schools, function(school, callback){
					var match = school.match(pat);
					console.log(match);
					partial += "<option value='"+match[1]+"'>"+match[1]+"</option>";
					callback();
				}, function(err){
					if(!err){
						callback(partial);
					}
				});
			});
		}
	},
	sru:{
		home:'',
		info:{}
	},
	psu:{},
	init:(function(){
		async.each(schools, function(school, callback){
			async.series([
				function(callback){
					model.set(model[school].apartmentKeys, model[school].collection, function(){ 
						callback(null); 
					});
				},
				function(callback){
					async.parallel({
						home: function(callback){
							var base = Plates.bind(view.home_base, model[school].page);
							var mapping = Plates.Map();
							if(model[school].collection.length != 0){ 
								var listing_partials = '';
								async.each(model[school].collection, function(collection_item, callback){
									var table_partial = {cat: '',dog: '',smoke: '',fios: '',cable: '',furnish: '',security: '',onsite: '',washer: '',storage: '',parking: ''};
									var sorted = collection_item.sort.split('');	
									Object.keys(table_partial).forEach(function(key, i){
										table_partial[key] = view.partials.table(sorted[i + 3]);
									});
									listing_partials += Plates.bind(view.base_partial, table_partial);
									callback(null);
								}, function(err, result){
									mapping.class('listing_wrapper').append(listing_partials);
									view[school].home = Plates.bind(base, {}, mapping);
									callback(null);
								});
							}
						},
						info: function(callback){
							async.each(model[school].collection, function(listing, callback){
								view[school].info[listing.id] = Plates.bind(view.info_base, listing);
							});
						}
					},function(err, result){
						if(err) console.log(err);
					});
				}
			], function(err, result){});
		}, function(err){});
	})()
};

var middleware = {
	scrub: function(req, res, next){
		var pat = new RegExp(/[^\}\^\$\!\'\"\(\)\{\;\\\/\0]/g);
		console.log(req.body);
		async.each(Object.keys(req.body), function(item, callback){
			if(req.body[item].length > 1000){
				callback("RegDoS Detected");
			}else{
				var match = req.body[item].match(pat) || '';
				var input = '';
				async.each(match, function(character, callback){
					input += character;
					callback();
				}, function(err){
					console.log(input);
					req.body[item]= input;	
				});
				callback();
			}
		}, function(err){
			if(err != null){
				console.log(err);
				res.send('invalid input');
			}else next();
		});
	}
};

app.use(express.static('js'));
app.use(express.static('css'));
app.use(express.static('img'));
app.use(bodyParser.urlencoded({extended: true}));

app.get('/Slippery-Rock', function(req, res, next){
	res.send(view.sru.home);
});

app.get('/Slippery-Rock/info', function(req, res, next){
	res.send(view.info_base);
});

app.get('/Penn-State', function(req, res, next){
	res.send(output);
});

app.get('/api', function(req, res, next){
	res.sendFile(__dirname + '/templates/api/manage.html');
});

app.get('/api/listing', function(req, res, next){
	view.api.schools_partial(function(partial){
		var mapping = Plates.Map();
		mapping.class('school-select').append(partial);
		res.send(Plates.bind(view.api.listing, {}, mapping));
	});
});

app.get('/api/property', function(req, res, next){
	view.api.schools_partial(function(partial){
		var mapping = Plates.Map();
		mapping.class('school-select').append(partial);
		res.send(Plates.bind(view.api.property, {}, mapping));
	});
});

app.get('/api/school', function(req, res, next){
	res.sendFile(__dirname + '/templates/api/school.html');
});

app.post('/api/school', middleware.scrub, function(req, res, next){
		
	var school = req.body.school.toLowerCase().split(' ').join('_') || "school";
	
	var writeData = {
		//
		////School Info
		//id, school, abr, state
		id: req.body.id || '',
		school: req.body.school || '',
		abr: req.body.abr || '',
		state: req.body.state || ''
	};
	res.send(writeData);
//	redisClient.HMSET("schools:" + school, writeData, function(error, response){
//		if(error != null) res.send('failure');
//		else{
//		 res.send(writeData);
//		 console.log("Successfully wrote to Redis : " + writeData);
//		}
//	});
});

app.post('/api/property', function(req, res, next){
	var property = req.body.property.toLowerCase().split(' ').join('_') || "unkown";
	
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
		hours: function(){
			var week = "Mon-Fri: " + req.body.week_start + "am - " + req.body.week_end + "pm";
			if(req.body.sat_start != ''){
				week = week + " | Sat: " + req.body.sat_start + "am - " + req.body.sat_end + "pm";
			}else{
				week = week + " | Sat: Closed";
			}
			if(req.body.sun_start != ''){
				week = week + " | Sun: " + req.body.sun_start + "am - " + req.body.sun_end + "pm";
			}else{
				week = week + " | Sun: Closed";
			}
			return week;
			
			},
		manager: req.body.manager || '',
		description: req.body.description || '',
		rating: req.body.rating || '',
		email: req.body.email || '',
		available: req.body.available || "Call for Availability"
	};

	redisClient.HMSET("properties:" + req.body.school + ":" + property, writeData, function(error, response){
		if(error != null) res.send('failure');
		else{
		 res.send(writeData);
		 console.log("Successfully wrote to Redis : " + writeData);
		}
	});
});

app.post('/api/listing', function(req, res, next){
	function deserialize(arr){
		var itemArray = [];
		for(i=0; i< arr.length; i++){
			if(arr[i] != ''){
				itemArray.push(arr[i]);
			}
		}
		return itemArray;
	};

	//type - price - beds - bath - cat - dog - smoke - fios - cable - furnish - security - onsite - washer - storage- parking 
	 function sortBuilder(){
			var sequence = '';
			if(writeData.type == 'room') sequence += '0';
			else if(writeData.type == 'apartment') sequence += '1';
			else if(writeData.type == 'house') sequence += '2';
			if(writeData.price <= 500) sequence += '1';
			else if(writeData.price <= 750) sequence += '2';
			else if(writeData.price <= 1000) sequence += '3';
			else if(writeData.price <= 1250) sequence += '4';
			else if(writeData.price <= 1500) sequence += '5';
			else if(writeData.price <= 2000) sequence += '6';
			else if(writeData.price <= 2500) sequence += '7';
			else if(writeData.price <= 3000) sequence += '8';
			else sequence += '9';
			sequence += writeData.beds;
			sequence += writeData.baths;
			if(writeData.cat == 'on') sequence += '0';
			else sequence += '1'
			if(writeData.dog == 'on') sequence += '0';
			else sequence += '1';
			if(writeData.smoke == 'on') sequence += '0';
			else sequence += '1';
			if(writeData.fios == 'on') sequence += '0';
			else sequence += '1';
			if(writeData.cable == 'on') sequence += '0';
			else sequence += '1';
			if(writeData.furnish == 'on') sequence += '0';
			else sequence += '1';
			if(writeData.security == 'on') sequence += '0';
			else sequence += '1';
			if(writeData.onsite == 'on') sequence += '0';
			else sequence += '1';
			if(writeData.washer == 'on') sequence += '0';
			else sequence += '1';
			if(writeData.storage == 'on') sequence += '0';
			else sequence += '1';
			if(writeData.parking == 'on') sequence += '0';
			else sequence += '1';
			return sequence;
		};
	console.log(req.body.type);
	var redid = [parseInt(Date.now() / 100000), process.hrtime()[1]].join(".");
	var writeData = {
		//
		//Property Detials
		//type, buildingName, buildingAddress
		type: req.body.type || "room",
		buildingName: req.body.buildingName,
		buildingAddress: req.body.buildingAddress,

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
		adds: deserialize(req.body.add),

		//
		//Pet Policy
		//dog, cat, pet1-5
		dogs: req.body.dog || '0',
		cats: req.body.cat || '0',
		policy: deserialize(req.body.pet), 

		//
		//Pricing
		depo: req.body.depo || 'Call for Details',
		beds: parseInt(req.body.bed) || "Studio",
		baths: parseInt(req.body.bath) || "1", 
		price: parseInt(req.body.price) || "Call for Details",
		sqft: req.body.sqft || "-",
		floorPics: deserialize(req.body.floorPic)
	};
	writeData.sort = sortBuilder();
	console.log(writeData);
	redisClient.HMSET("listings:test:" + req.body.school + ":" + redid, writeData, function(error, response){
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

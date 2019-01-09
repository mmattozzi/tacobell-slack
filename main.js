const request = require("request");
const cheerio = require("cheerio");
const storage = require('node-persist');
const config = require('./config.json');

function retrieveNewItems(callback) {
  request("https://www.tacobell.com/food/new", function(err, response,  body) {
    if (! err) {
      const $ = cheerio.load(body);
      var newItems = $(".product-item").map((i, elem) => { 
        return { 
          "item": $(elem).find(".product-name").find("a").text(), 
          "price": $(elem).find(".product-price").find("span").text(), 
          "image":  $(elem).find("img").attr("srcset") 
        }; 
      }).get();
      callback(newItems);
    }
  });
}

function hasItem(item, set) {
  var found = false;
  set.forEach(function(x) {
      if (x.item === item.item) {
        found = true;
      }
  });
  return found;
}

function run() {
  console.log("Checking for updated Taco Bell items");
  storage.getItem("items").then(function(savedItems) {
    
    retrieveNewItems(function(items) {
      var filteredList = items;
      if (savedItems) {
        var filteredList = items.filter(i => ! hasItem(i, savedItems));
      }
      console.log(JSON.stringify(filteredList, null, 2));
      var promise = storage.setItem("items", items);
      promise.then(function() { }, function(err) { console.log(err); });
      
      if (filteredList.length > 0) {
        var data = {
          "attachments": [],
          "unfurl_links": true,
          "unfurl_media":true
        }
        
        filteredList.forEach(item => {
          data.attachments.push({
            "color": "green",
            "title": item.item + " (" + item.price + ")",
            "fallback": item.item,
            "text": item.item,
            "image_url": item.image
          });
        });
        
        var slackPostOptions = {
          "method": "POST",
          "url": config.slackUrl,
          "headers": {
            "Content-Type": "application/json"
          },
          "body": JSON.stringify(data)
        }
        
        request(slackPostOptions, function(err, response, body) {
          console.log("Post to slack got response: " + response.statusCode);
        });
      }
      
    });
  });
}

storage.init().then(() => {
  console.log("Initialized storage, setting interval");
  setInterval(run, 86400000);
});

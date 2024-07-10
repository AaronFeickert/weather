// Convert miles to kilometers
function convert_km_to_mi(km) {
    return 0.621371 * km;
}

// Convert degrees Celsius to degrees Fahrenheit
function convert_c_to_f(c) {
    return 1.8 * c + 32;
}

// Convert knots to miles per hour
function convert_kts_to_mph(kts) {
    return 1.15078 * kts;
}

// Round a numerical value to a given number of decimal places
function round(v, places) {
    return Math.round(v * Math.pow(10, places)) / Math.pow(10, places);
}

// Convert a three-letter month representation to a zero-indexed integer
function monthToInt(m) {
    months = {};
    months['Jan'] = 0;
    months['Feb'] = 1;
    months['Mar'] = 2;
    months['Apr'] = 3;
    months['May'] = 4;
    months['Jun'] = 5;
    months['Jul'] = 6;
    months['Aug'] = 7;
    months['Sep'] = 8;
    months['Oct'] = 9;
    months['Nov'] = 10;
    months['Dec'] = 11;

    return months[m];
}

// Location data
let currentLocation;

// Forecast data
let forecast_weather = [];
let forecast_uv = [];

// Get live weather data from MSP and display it
async function getLiveData() {
    // Get the data
    let response = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://online.saiawos.com/MSP/ios/webgetjson.php?buster=' + (new Date()).getTime()), { cache: 'reload' });
    let data = await response.json();

    // Get the observation age in minutes
    document.getElementById('time').textContent = data['utc'];

    // Get wind speed in miles per hour
    let wind_speed = data['wndSpd'];
    document.getElementById('wind_speed').textContent = round(convert_kts_to_mph(wind_speed), 1) + ' mph';
    
    // Get wind direction in degrees
    let wind_direction = data['wndDir']
    document.getElementById('wind_direction').textContent = wind_direction;

    // Get temperature in degrees Fahrenheit
    let temperature = data['temp'];
    document.getElementById('temperature').textContent = temperature.substring(0, temperature.indexOf('(')) + ' F';
    let apparent = data['heatIndex'] != "N/A" ? data['heatIndex'] : data['windChill'];
    document.getElementById('apparent').textContent = apparent;

    // Get humidity in percent
    let humidity = data['relHum']
    document.getElementById('humidity').textContent = humidity + '%';

    // Update the data twice a minute
    setTimeout(getLiveData, 30 * 1000);
}

// Get weather forecast data for the current location
async function getWeather(latitude, longitude) {
    // Get grid data (caching is fine here)
    let response = await fetch('https://api.weather.gov/points/' + latitude + ',' + longitude);
    let data = await response.json();

    // Get hourly forecast data
    response = await fetch(data.properties.forecastHourly, { cache: 'reload' });
    data = await response.json();

    // Store the data for the next half day
    data.properties.periods.forEach((period, i) => {
        if (i > 12) {
            return;
        }

        let this_hour = {};

        // Get the time data for this hour
        let date = new Date(period.startTime);
        this_hour['year'] = date.getFullYear();
        this_hour['month'] = date.getMonth();
        this_hour['date'] = date.getDate();
        this_hour['hour'] = date.getHours();

        // Get the forecast data
        this_hour['temperature'] = period.temperature;
        this_hour['windSpeed'] = period.windSpeed;
        this_hour['windDirection'] = period.windDirection;
        this_hour['precipitation'] = period.probabilityOfPrecipitation.value;
        this_hour['forecast'] = period.shortForecast;
        this_hour['iconURL'] = period.icon;

        // Add this hour to the data
        forecast_weather.push(this_hour);
    });
}

// Get UV forecast data for the current location
async function getUV(latitude, longitude) {
    // Get UV forecast data
    response = await fetch('https://data.epa.gov/efservice/getEnvirofactsUVHourly/LATITUDE/' + latitude + '/LONGITUDE/' + longitude + '/JSON', { cache: 'reload' });
    data = await response.json();

    // Store the data for today
    data.forEach((period, _) => {
        let this_hour = {};

        // Get the time data for this hour
        // Example format: Jan/01/2024 12 PM
        //                 01234567890123456
        let date = period.DATE_TIME;
        this_hour['month'] = parseInt(monthToInt(date.slice(0, 3)));
        this_hour['date'] = parseInt(date.slice(4, 6));
        this_hour['year'] = parseInt(date.slice(7, 11));

        let raw_hour = parseInt(date.slice(12, 14));
        let am_pm = date.slice(15);
        if (am_pm == 'AM') {
            if (raw_hour == 12) {
                this_hour['hour'] = 0;
            } else {
                this_hour['hour'] = raw_hour;
            }
        } else if (am_pm == 'PM' && raw_hour == 12) {
            this_hour['hour'] = raw_hour;
        } else {
            this_hour['hour'] = raw_hour + 12;
        }

        // Get the forecast data
        this_hour['uv'] = period.UV_VALUE;

        // Add this hour to the data
        forecast_uv.push(this_hour);
    });
}

// Utility function to test for period matches
function matches(weather, uv) {
    if (
        weather['year'] == uv['year'] &&
        weather['month'] == uv['month'] &&
        weather['date'] == uv['date'] &&
        weather['hour'] == uv['hour']
    ) {
        return true;
    } else {
        return false;
    }
}

// Get and display all location-specific data
async function getForecast() {
    let latitude = currentLocation.coords.latitude;
    let longitude = currentLocation.coords.longitude;

    // Get weather and UV forecasts in parallel
    await Promise.all([
        getWeather(latitude, longitude),
        getUV(latitude, longitude)
    ]);

    // Clear the table
    let table = document.getElementById('forecast'); 
    while (table.firstChild) {
        table.firstChild.remove();
    }

    // Combine the data, anchored to the weather forecast
    forecast_weather.forEach((period_weather, _) => {
        let row = table.insertRow();

        // Include the data fields
        let fields = [
            period_weather['hour'] + ':00',
            period_weather['temperature'] + ' F',
            '-', // default UV index when no data is available
            period_weather['windSpeed'],
            period_weather['windDirection'],
            period_weather['precipitation'] + '%',
            period_weather['forecast'],
        ];

        // Check the UV forecast (super duper inefficiently)
        forecast_uv.forEach((period_uv, _) => {
            if (matches(period_weather, period_uv)) {
                fields[2] = period_uv['uv'];
            }
        });

        // Display the data fields
        fields.forEach((field, _) => {
            var cell = row.insertCell();
            cell.textContent = field;
        });

        // Display the graphic
        var graphic = document.createElement('img');
        graphic.src = period_weather['iconURL'];
        var cell = row.insertCell();
        cell.appendChild(graphic);
    });

    // Clear the data
    forecast_weather = [];
    forecast_uv = [];

    // Update the data every five minutes
    setTimeout(getForecast, 5 * 60 * 1000);
}

async function getAllData() {
    // Get the forecast once we have a location
    navigator.geolocation.getCurrentPosition((location) => {
        currentLocation = location;
        getForecast();
    });

    // Get the live data, which does not require a location
    getLiveData();
}

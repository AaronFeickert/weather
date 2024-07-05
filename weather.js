// Conversion functions
function convert_km_to_mi(km) {
    return 0.621371 * km;
}

function convert_c_to_f(c) {
    return 1.8 * c + 32;
}

function convert_kts_to_mph(kts) {
    return 1.15078 * kts;
}

function round(v, places) {
    return Math.round(v * Math.pow(10, places)) / Math.pow(10, places);
}

async function getLiveData() {
    // Get the data
    let response = await fetch("https://mesonet.agron.iastate.edu/json/current.py?network=MN_ASOS&station=MSP");
    let data = await response.json();

    // Get the observation age
    let now = new Date();
    let observation_time = new Date(data.last_ob.utc_valid);
    document.getElementById("age").textContent = Math.round((now - observation_time) / 1000 / 60);

    // Get wind speed (mi/h)
    let wind_speed = data.last_ob['windspeed[kt]']
    if (wind_speed === null) {
        document.getElementById("wind_speed").textContent = "n/a";
    } else {
        document.getElementById("wind_speed").textContent = round(convert_kts_to_mph(wind_speed), 1);
    }
    
    // Get wind direction (deg)
    let wind_direction = data.last_ob['winddirection[deg]']
    if (wind_direction === null) {
        document.getElementById("wind_direction").textContent = "n/a";
    } else {
        document.getElementById("wind_direction").textContent = wind_direction;
    }

    // Get temperature (F)
    let temperature = data.last_ob['airtemp[F]']
    if (temperature === null) {
        document.getElementById("temperature").textContent = "n/a";
    } else {
        document.getElementById("temperature").textContent = round(temperature, 1);
    }
}

async function getForecast(location) {
    // Get grid data
    let latitude = location.coords.latitude;
    let longitude = location.coords.longitude;

    let response = await fetch("https://api.weather.gov/points/" + latitude + "," + longitude);
    let data = await response.json();

    // Get hourly forecast data
    response = await fetch(data.properties.forecastHourly);
    data = await response.json();

    data.properties.periods.forEach((period, i) => {
        // Get the next half day
        if (i >= 12) {
            return;
        }
        var table = document.getElementById("forecast"); 
        var row = table.insertRow();

        // Pull the desired fields
        let fields = [
            (new Date(period.startTime)).toLocaleTimeString(),
            period.temperature,
            period.windSpeed,
            period.windDirection,
            period.probabilityOfPrecipitation.value,
            period.shortForecast,
        ];
        fields.forEach((field, _) => {
            var cell = row.insertCell();
            cell.textContent = field;
        });

        // Include a graphic for the weather
        var graphic = document.createElement("img");
        graphic.src = "https://api.weather.gov" + period.icon;
        var cell = row.insertCell();
        cell.appendChild(graphic);
    });

    // Get UV forecast data
    response = await fetch("https://data.epa.gov/efservice/getEnvirofactsUVHourly/LATITUDE/" + latitude + "/LONGITUDE/" + longitude + "/JSON");
    data = await response.json();

    data.forEach((period, i) => {
        // Parse out only data for today
        let today = (new Date()).getDate();
        if (period.DATE_TIME.slice(4, 6) != today) {
            return;
        }

        var table = document.getElementById("uv"); 
        var row = table.insertRow();

        var cell = row.insertCell();
        cell.textContent = period.DATE_TIME.slice(-5);

        cell = row.insertCell();
        cell.textContent = period.UV_VALUE;
    });
}

// Get the forecast once we have a location
navigator.geolocation.getCurrentPosition(getForecast);

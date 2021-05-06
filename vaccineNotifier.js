require('dotenv').config()
const moment = require('moment');
const cron = require('node-cron');
const axios = require('axios');
const notifier = require('./notifier');

const csv = require('csv-parser');
const fs = require('fs');

/**
Step 1) Enable application access on your gmail with steps given here:
 https://support.google.com/accounts/answer/185833?p=InvalidSecondFactor&visit_id=637554658548216477-2576856839&rd=1

Step 2) Enter the details in the file .env, present in the same folder

Step 3) On your terminal run: npm i && pm2 start vaccineNotifier.js

To close the app, run: pm2 stop vaccineNotifier.js && pm2 delete vaccineNotifier.js
 */

//const PINCODE = process.env.PINCODE
//const EMAIL = process.env.EMAIL
//const AGE = process.env.AGE

async function main(){
    
    try {
        let datas = await getEmpDetailsByEmailIdAndUniqueCode("data.csv");
        for (var j = 0; j < datas.length; j++){
            await checkAvailability(datas[j].email, datas[j].pincode, datas[j].age);
        }
    } catch (e) {
        console.log('an error occured: ' + JSON.stringify(e, null, 2));
        throw e;
    }
}



async function getEmpDetailsByEmailIdAndUniqueCode(fileName){
    return new Promise(function(resolve,reject){
      var fetchData = [];
      fs.createReadStream(fileName)
        .pipe(csv())
        .on('data', (row) => {
            fetchData.push(row);
        })
        .on('end', () => {
          console.log('CSV file successfully processed');
          resolve(fetchData);
        })
        .on('error', reject);
    })
  }


async function checkAvailability(email, pincode, age) {
    let datesArray = await fetchNext10Days();
    datesArray.forEach(date => {
        getSlotsForDate(date, email, pincode, age);
    })
}

function getSlotsForDate(DATE, email, pincode, age) {
    let config = {
        method: 'get',
        url: 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/findByPin?pincode=' + pincode + '&date=' + DATE,
        headers: {
            'accept': 'application/json',
            'Accept-Language': 'hi_IN'
        }
    };

    axios(config)
        .then(function (slots) {
            let sessions = slots.data.sessions;
            let validSlots = sessions.filter(slot => slot.min_age_limit <= age &&  slot.available_capacity > 0)
            console.log({date:DATE, validSlots: validSlots.length})
            if(validSlots.length > 0) {
                notifyMe(validSlots, email);
            }
        })
        .catch(function (error) {
            console.log(error);
        });
}

async function

notifyMe(validSlots,  email){
    let slotDetails = JSON.stringify(validSlots, null, '\t');
    notifier.sendEmail(email, 'VACCINE AVAILABLE', slotDetails, (err, result) => {
        if(err) {
            console.error({err});
        }
    })
};

async function fetchNext10Days(){
    let dates = [];
    let today = moment();
    for(let i = 0 ; i < 10 ; i ++ ){
        let dateString = today.format('DD-MM-YYYY')
        dates.push(dateString);
        today.add(1, 'day');
    }
    return dates;
}


main()
    .then(() => {console.log('Vaccine availability checker started.');});

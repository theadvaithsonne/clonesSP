/**
 * One-time seed: populate PincodeData collection with Indian PIN codes.
 * Covers all 28 states + 8 Union Territories.
 *
 * Run:  npx tsx src/scripts/seedPincodes.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { PincodeData } from "../models/pincodeData.model";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";

const PINCODES: { code: string; city: string; state: string }[] = [
  // Delhi / NCR
  { code: "110001", city: "New Delhi", state: "Delhi" },
  { code: "110002", city: "New Delhi", state: "Delhi" },
  { code: "110011", city: "New Delhi", state: "Delhi" },
  { code: "110020", city: "New Delhi", state: "Delhi" },
  { code: "110034", city: "New Delhi", state: "Delhi" },
  { code: "110048", city: "New Delhi", state: "Delhi" },
  { code: "110085", city: "New Delhi", state: "Delhi" },
  { code: "110092", city: "New Delhi", state: "Delhi" },
  { code: "122001", city: "Gurugram", state: "Haryana" },
  { code: "122002", city: "Gurugram", state: "Haryana" },
  { code: "122015", city: "Gurugram", state: "Haryana" },
  { code: "201301", city: "Noida", state: "Uttar Pradesh" },
  { code: "201304", city: "Noida", state: "Uttar Pradesh" },
  { code: "201305", city: "Noida", state: "Uttar Pradesh" },
  { code: "201010", city: "Ghaziabad", state: "Uttar Pradesh" },
  { code: "201012", city: "Greater Noida", state: "Uttar Pradesh" },
  { code: "121001", city: "Faridabad", state: "Haryana" },

  // Maharashtra
  { code: "400001", city: "Mumbai", state: "Maharashtra" },
  { code: "400002", city: "Mumbai", state: "Maharashtra" },
  { code: "400003", city: "Mumbai", state: "Maharashtra" },
  { code: "400051", city: "Mumbai", state: "Maharashtra" },
  { code: "400053", city: "Mumbai", state: "Maharashtra" },
  { code: "400069", city: "Mumbai", state: "Maharashtra" },
  { code: "400070", city: "Mumbai", state: "Maharashtra" },
  { code: "400093", city: "Mumbai", state: "Maharashtra" },
  { code: "400601", city: "Thane", state: "Maharashtra" },
  { code: "400614", city: "Navi Mumbai", state: "Maharashtra" },
  { code: "411001", city: "Pune", state: "Maharashtra" },
  { code: "411006", city: "Pune", state: "Maharashtra" },
  { code: "411014", city: "Pune", state: "Maharashtra" },
  { code: "411057", city: "Pune", state: "Maharashtra" },
  { code: "440001", city: "Nagpur", state: "Maharashtra" },
  { code: "440010", city: "Nagpur", state: "Maharashtra" },
  { code: "431001", city: "Chhatrapati Sambhajinagar", state: "Maharashtra" },
  { code: "416001", city: "Kolhapur", state: "Maharashtra" },
  { code: "422001", city: "Nashik", state: "Maharashtra" },
  { code: "421001", city: "Thane", state: "Maharashtra" },
  { code: "401107", city: "Vasai", state: "Maharashtra" },
  { code: "444601", city: "Amravati", state: "Maharashtra" },
  { code: "425001", city: "Jalgaon", state: "Maharashtra" },
  { code: "413001", city: "Solapur", state: "Maharashtra" },

  // Karnataka
  { code: "560001", city: "Bengaluru", state: "Karnataka" },
  { code: "560002", city: "Bengaluru", state: "Karnataka" },
  { code: "560011", city: "Bengaluru", state: "Karnataka" },
  { code: "560025", city: "Bengaluru", state: "Karnataka" },
  { code: "560066", city: "Bengaluru", state: "Karnataka" },
  { code: "560100", city: "Bengaluru", state: "Karnataka" },
  { code: "575001", city: "Mangaluru", state: "Karnataka" },
  { code: "580001", city: "Hubballi", state: "Karnataka" },
  { code: "590001", city: "Belagavi", state: "Karnataka" },
  { code: "570001", city: "Mysuru", state: "Karnataka" },
  { code: "573201", city: "Hassan", state: "Karnataka" },
  { code: "577001", city: "Shivamogga", state: "Karnataka" },
  { code: "583101", city: "Ballari", state: "Karnataka" },

  // Tamil Nadu
  { code: "600001", city: "Chennai", state: "Tamil Nadu" },
  { code: "600002", city: "Chennai", state: "Tamil Nadu" },
  { code: "600017", city: "Chennai", state: "Tamil Nadu" },
  { code: "600020", city: "Chennai", state: "Tamil Nadu" },
  { code: "600119", city: "Chennai", state: "Tamil Nadu" },
  { code: "641001", city: "Coimbatore", state: "Tamil Nadu" },
  { code: "641046", city: "Coimbatore", state: "Tamil Nadu" },
  { code: "625001", city: "Madurai", state: "Tamil Nadu" },
  { code: "620001", city: "Tiruchirappalli", state: "Tamil Nadu" },
  { code: "636001", city: "Salem", state: "Tamil Nadu" },
  { code: "627001", city: "Tirunelveli", state: "Tamil Nadu" },
  { code: "632001", city: "Vellore", state: "Tamil Nadu" },
  { code: "623001", city: "Ramanathapuram", state: "Tamil Nadu" },
  { code: "638001", city: "Erode", state: "Tamil Nadu" },

  // Telangana
  { code: "500001", city: "Hyderabad", state: "Telangana" },
  { code: "500003", city: "Hyderabad", state: "Telangana" },
  { code: "500032", city: "Hyderabad", state: "Telangana" },
  { code: "500081", city: "Hyderabad", state: "Telangana" },
  { code: "500084", city: "Hyderabad", state: "Telangana" },
  { code: "500090", city: "Hyderabad", state: "Telangana" },
  { code: "501301", city: "Sangareddy", state: "Telangana" },
  { code: "506001", city: "Warangal", state: "Telangana" },
  { code: "508001", city: "Nalgonda", state: "Telangana" },
  { code: "504001", city: "Adilabad", state: "Telangana" },

  // Andhra Pradesh
  { code: "520001", city: "Vijayawada", state: "Andhra Pradesh" },
  { code: "530001", city: "Visakhapatnam", state: "Andhra Pradesh" },
  { code: "530026", city: "Visakhapatnam", state: "Andhra Pradesh" },
  { code: "522001", city: "Guntur", state: "Andhra Pradesh" },
  { code: "515001", city: "Anantapur", state: "Andhra Pradesh" },
  { code: "517001", city: "Tirupati", state: "Andhra Pradesh" },
  { code: "533001", city: "Rajamahendravaram", state: "Andhra Pradesh" },
  { code: "524001", city: "Nellore", state: "Andhra Pradesh" },
  { code: "518001", city: "Kurnool", state: "Andhra Pradesh" },

  // West Bengal
  { code: "700001", city: "Kolkata", state: "West Bengal" },
  { code: "700005", city: "Kolkata", state: "West Bengal" },
  { code: "700013", city: "Kolkata", state: "West Bengal" },
  { code: "700019", city: "Kolkata", state: "West Bengal" },
  { code: "700091", city: "Kolkata", state: "West Bengal" },
  { code: "700156", city: "Kolkata", state: "West Bengal" },
  { code: "711101", city: "Howrah", state: "West Bengal" },
  { code: "713101", city: "Asansol", state: "West Bengal" },
  { code: "734001", city: "Siliguri", state: "West Bengal" },
  { code: "741101", city: "Krishnanagar", state: "West Bengal" },
  { code: "721101", city: "Midnapore", state: "West Bengal" },
  { code: "743101", city: "Barasat", state: "West Bengal" },

  // Gujarat
  { code: "380001", city: "Ahmedabad", state: "Gujarat" },
  { code: "380006", city: "Ahmedabad", state: "Gujarat" },
  { code: "380015", city: "Ahmedabad", state: "Gujarat" },
  { code: "380058", city: "Ahmedabad", state: "Gujarat" },
  { code: "395001", city: "Surat", state: "Gujarat" },
  { code: "395007", city: "Surat", state: "Gujarat" },
  { code: "390001", city: "Vadodara", state: "Gujarat" },
  { code: "360001", city: "Rajkot", state: "Gujarat" },
  { code: "364001", city: "Bhavnagar", state: "Gujarat" },
  { code: "361001", city: "Jamnagar", state: "Gujarat" },
  { code: "382001", city: "Gandhinagar", state: "Gujarat" },
  { code: "370001", city: "Bhuj", state: "Gujarat" },
  { code: "396001", city: "Valsad", state: "Gujarat" },

  // Rajasthan
  { code: "302001", city: "Jaipur", state: "Rajasthan" },
  { code: "302017", city: "Jaipur", state: "Rajasthan" },
  { code: "302021", city: "Jaipur", state: "Rajasthan" },
  { code: "313001", city: "Udaipur", state: "Rajasthan" },
  { code: "342001", city: "Jodhpur", state: "Rajasthan" },
  { code: "324001", city: "Kota", state: "Rajasthan" },
  { code: "334001", city: "Bikaner", state: "Rajasthan" },
  { code: "305001", city: "Ajmer", state: "Rajasthan" },
  { code: "301001", city: "Alwar", state: "Rajasthan" },
  { code: "311001", city: "Bhilwara", state: "Rajasthan" },

  // Uttar Pradesh
  { code: "226001", city: "Lucknow", state: "Uttar Pradesh" },
  { code: "226010", city: "Lucknow", state: "Uttar Pradesh" },
  { code: "226022", city: "Lucknow", state: "Uttar Pradesh" },
  { code: "208001", city: "Kanpur", state: "Uttar Pradesh" },
  { code: "208002", city: "Kanpur", state: "Uttar Pradesh" },
  { code: "221001", city: "Varanasi", state: "Uttar Pradesh" },
  { code: "211001", city: "Prayagraj", state: "Uttar Pradesh" },
  { code: "250001", city: "Meerut", state: "Uttar Pradesh" },
  { code: "282001", city: "Agra", state: "Uttar Pradesh" },
  { code: "243001", city: "Bareilly", state: "Uttar Pradesh" },
  { code: "273001", city: "Gorakhpur", state: "Uttar Pradesh" },
  { code: "244001", city: "Moradabad", state: "Uttar Pradesh" },
  { code: "247001", city: "Saharanpur", state: "Uttar Pradesh" },
  { code: "204101", city: "Aligarh", state: "Uttar Pradesh" },
  { code: "241001", city: "Hardoi", state: "Uttar Pradesh" },

  // Madhya Pradesh
  { code: "462001", city: "Bhopal", state: "Madhya Pradesh" },
  { code: "462011", city: "Bhopal", state: "Madhya Pradesh" },
  { code: "452001", city: "Indore", state: "Madhya Pradesh" },
  { code: "452010", city: "Indore", state: "Madhya Pradesh" },
  { code: "482001", city: "Jabalpur", state: "Madhya Pradesh" },
  { code: "474001", city: "Gwalior", state: "Madhya Pradesh" },
  { code: "455001", city: "Dewas", state: "Madhya Pradesh" },
  { code: "458001", city: "Mandsaur", state: "Madhya Pradesh" },
  { code: "466001", city: "Sehore", state: "Madhya Pradesh" },

  // Chhattisgarh
  { code: "492001", city: "Raipur", state: "Chhattisgarh" },
  { code: "492006", city: "Raipur", state: "Chhattisgarh" },
  { code: "495001", city: "Bilaspur", state: "Chhattisgarh" },
  { code: "491001", city: "Durg", state: "Chhattisgarh" },
  { code: "496001", city: "Raigarh", state: "Chhattisgarh" },
  { code: "497001", city: "Ambikapur", state: "Chhattisgarh" },

  // Bihar
  { code: "800001", city: "Patna", state: "Bihar" },
  { code: "800020", city: "Patna", state: "Bihar" },
  { code: "842001", city: "Muzaffarpur", state: "Bihar" },
  { code: "823001", city: "Gaya", state: "Bihar" },
  { code: "812001", city: "Bhagalpur", state: "Bihar" },
  { code: "841301", city: "Chapra", state: "Bihar" },
  { code: "844101", city: "Hajipur", state: "Bihar" },
  { code: "803101", city: "Bihar Sharif", state: "Bihar" },

  // Jharkhand
  { code: "834001", city: "Ranchi", state: "Jharkhand" },
  { code: "834002", city: "Ranchi", state: "Jharkhand" },
  { code: "826001", city: "Dhanbad", state: "Jharkhand" },
  { code: "831001", city: "Jamshedpur", state: "Jharkhand" },
  { code: "815301", city: "Hazaribagh", state: "Jharkhand" },
  { code: "828101", city: "Bokaro", state: "Jharkhand" },
  { code: "835101", city: "Lohardaga", state: "Jharkhand" },

  // Odisha
  { code: "751001", city: "Bhubaneswar", state: "Odisha" },
  { code: "751007", city: "Bhubaneswar", state: "Odisha" },
  { code: "753001", city: "Cuttack", state: "Odisha" },
  { code: "769001", city: "Rourkela", state: "Odisha" },
  { code: "760001", city: "Berhampur", state: "Odisha" },
  { code: "768001", city: "Sambalpur", state: "Odisha" },
  { code: "756001", city: "Balasore", state: "Odisha" },

  // Kerala
  { code: "695001", city: "Thiruvananthapuram", state: "Kerala" },
  { code: "695004", city: "Thiruvananthapuram", state: "Kerala" },
  { code: "695011", city: "Thiruvananthapuram", state: "Kerala" },
  { code: "682001", city: "Kochi", state: "Kerala" },
  { code: "682011", city: "Kochi", state: "Kerala" },
  { code: "682016", city: "Kochi", state: "Kerala" },
  { code: "673001", city: "Kozhikode", state: "Kerala" },
  { code: "670001", city: "Kannur", state: "Kerala" },
  { code: "679001", city: "Palakkad", state: "Kerala" },
  { code: "676001", city: "Malappuram", state: "Kerala" },
  { code: "686001", city: "Kottayam", state: "Kerala" },
  { code: "680001", city: "Thrissur", state: "Kerala" },
  { code: "689001", city: "Pathanamthitta", state: "Kerala" },
  { code: "671001", city: "Kasaragod", state: "Kerala" },

  // Punjab
  { code: "143001", city: "Amritsar", state: "Punjab" },
  { code: "143006", city: "Amritsar", state: "Punjab" },
  { code: "141001", city: "Ludhiana", state: "Punjab" },
  { code: "141010", city: "Ludhiana", state: "Punjab" },
  { code: "147001", city: "Patiala", state: "Punjab" },
  { code: "144001", city: "Jalandhar", state: "Punjab" },
  { code: "140001", city: "Rupnagar", state: "Punjab" },
  { code: "148001", city: "Sangrur", state: "Punjab" },
  { code: "151001", city: "Bathinda", state: "Punjab" },

  // Haryana
  { code: "132001", city: "Panipat", state: "Haryana" },
  { code: "125001", city: "Hisar", state: "Haryana" },
  { code: "131001", city: "Sonipat", state: "Haryana" },
  { code: "124001", city: "Rohtak", state: "Haryana" },
  { code: "133001", city: "Ambala", state: "Haryana" },
  { code: "123001", city: "Rewari", state: "Haryana" },
  { code: "136001", city: "Kurukshetra", state: "Haryana" },
  { code: "126001", city: "Jind", state: "Haryana" },
  { code: "127021", city: "Bhiwani", state: "Haryana" },

  // Chandigarh
  { code: "160001", city: "Chandigarh", state: "Chandigarh" },
  { code: "160017", city: "Chandigarh", state: "Chandigarh" },
  { code: "160036", city: "Chandigarh", state: "Chandigarh" },
  { code: "160055", city: "Chandigarh", state: "Chandigarh" },

  // Himachal Pradesh
  { code: "171001", city: "Shimla", state: "Himachal Pradesh" },
  { code: "171005", city: "Shimla", state: "Himachal Pradesh" },
  { code: "176001", city: "Dharamsala", state: "Himachal Pradesh" },
  { code: "175001", city: "Mandi", state: "Himachal Pradesh" },
  { code: "174101", city: "Bilaspur", state: "Himachal Pradesh" },
  { code: "177001", city: "Hamirpur", state: "Himachal Pradesh" },
  { code: "173001", city: "Solan", state: "Himachal Pradesh" },

  // Uttarakhand
  { code: "248001", city: "Dehradun", state: "Uttarakhand" },
  { code: "248002", city: "Dehradun", state: "Uttarakhand" },
  { code: "248145", city: "Mussoorie", state: "Uttarakhand" },
  { code: "263001", city: "Nainital", state: "Uttarakhand" },
  { code: "249401", city: "Rishikesh", state: "Uttarakhand" },
  { code: "249137", city: "Haridwar", state: "Uttarakhand" },
  { code: "263139", city: "Haldwani", state: "Uttarakhand" },
  { code: "244713", city: "Kashipur", state: "Uttarakhand" },
  { code: "246001", city: "Pauri", state: "Uttarakhand" },
  { code: "249201", city: "Tehri", state: "Uttarakhand" },

  // Assam
  { code: "781001", city: "Guwahati", state: "Assam" },
  { code: "781003", city: "Guwahati", state: "Assam" },
  { code: "781022", city: "Guwahati", state: "Assam" },
  { code: "785001", city: "Jorhat", state: "Assam" },
  { code: "788001", city: "Silchar", state: "Assam" },
  { code: "786001", city: "Dibrugarh", state: "Assam" },
  { code: "782001", city: "Nagaon", state: "Assam" },
  { code: "784001", city: "Tezpur", state: "Assam" },
  { code: "787001", city: "North Lakhimpur", state: "Assam" },

  // Manipur
  { code: "795001", city: "Imphal", state: "Manipur" },
  { code: "795002", city: "Imphal", state: "Manipur" },
  { code: "795003", city: "Imphal", state: "Manipur" },
  { code: "795004", city: "Imphal East", state: "Manipur" },
  { code: "795005", city: "Thoubal", state: "Manipur" },
  { code: "795101", city: "Churachandpur", state: "Manipur" },
  { code: "795115", city: "Senapati", state: "Manipur" },
  { code: "795116", city: "Ukhrul", state: "Manipur" },
  { code: "795117", city: "Chandel", state: "Manipur" },
  { code: "795118", city: "Bishnupur", state: "Manipur" },
  { code: "795119", city: "Tamenglong", state: "Manipur" },
  { code: "795130", city: "Imphal East", state: "Manipur" },
  { code: "795131", city: "Thoubal", state: "Manipur" },
  { code: "795132", city: "Imphal West", state: "Manipur" },
  { code: "795140", city: "Imphal", state: "Manipur" },
  { code: "795141", city: "Imphal West", state: "Manipur" },
  { code: "795142", city: "Bishnupur", state: "Manipur" },
  { code: "795143", city: "Bishnupur", state: "Manipur" },
  { code: "795145", city: "Churachandpur", state: "Manipur" },
  { code: "795146", city: "Senapati", state: "Manipur" },
  { code: "795148", city: "Churachandpur", state: "Manipur" },
  { code: "795150", city: "Imphal", state: "Manipur" },
  { code: "795159", city: "Ukhrul", state: "Manipur" },

  // Meghalaya
  { code: "793001", city: "Shillong", state: "Meghalaya" },
  { code: "793002", city: "Shillong", state: "Meghalaya" },
  { code: "793103", city: "Tura", state: "Meghalaya" },
  { code: "793109", city: "Jowai", state: "Meghalaya" },

  // Mizoram
  { code: "796001", city: "Aizawl", state: "Mizoram" },
  { code: "796005", city: "Aizawl", state: "Mizoram" },
  { code: "796501", city: "Lunglei", state: "Mizoram" },
  { code: "796691", city: "Saiha", state: "Mizoram" },

  // Nagaland
  { code: "797001", city: "Kohima", state: "Nagaland" },
  { code: "797003", city: "Kohima", state: "Nagaland" },
  { code: "798601", city: "Dimapur", state: "Nagaland" },
  { code: "798612", city: "Dimapur", state: "Nagaland" },
  { code: "798615", city: "Mokokchung", state: "Nagaland" },

  // Tripura
  { code: "799001", city: "Agartala", state: "Tripura" },
  { code: "799002", city: "Agartala", state: "Tripura" },
  { code: "799006", city: "Agartala", state: "Tripura" },
  { code: "799101", city: "Dharmanagar", state: "Tripura" },
  { code: "799201", city: "Udaipur", state: "Tripura" },

  // Arunachal Pradesh
  { code: "791001", city: "Itanagar", state: "Arunachal Pradesh" },
  { code: "791111", city: "Naharlagun", state: "Arunachal Pradesh" },
  { code: "790001", city: "Tawang", state: "Arunachal Pradesh" },
  { code: "792001", city: "Pasighat", state: "Arunachal Pradesh" },
  { code: "791102", city: "Ziro", state: "Arunachal Pradesh" },

  // Sikkim
  { code: "737101", city: "Gangtok", state: "Sikkim" },
  { code: "737102", city: "Gangtok", state: "Sikkim" },
  { code: "737116", city: "Gyalshing", state: "Sikkim" },
  { code: "737121", city: "Namchi", state: "Sikkim" },

  // Goa
  { code: "403001", city: "Panaji", state: "Goa" },
  { code: "403601", city: "Vasco da Gama", state: "Goa" },
  { code: "403501", city: "Mapusa", state: "Goa" },
  { code: "403401", city: "Margao", state: "Goa" },
  { code: "403101", city: "Ponda", state: "Goa" },
  { code: "403201", city: "Bicholim", state: "Goa" },

  // Jammu & Kashmir
  { code: "190001", city: "Srinagar", state: "Jammu & Kashmir" },
  { code: "190002", city: "Srinagar", state: "Jammu & Kashmir" },
  { code: "190011", city: "Srinagar", state: "Jammu & Kashmir" },
  { code: "180001", city: "Jammu", state: "Jammu & Kashmir" },
  { code: "180006", city: "Jammu", state: "Jammu & Kashmir" },
  { code: "192101", city: "Anantnag", state: "Jammu & Kashmir" },
  { code: "193101", city: "Baramulla", state: "Jammu & Kashmir" },
  { code: "191111", city: "Sopore", state: "Jammu & Kashmir" },

  // Ladakh
  { code: "194101", city: "Leh", state: "Ladakh" },
  { code: "194102", city: "Leh", state: "Ladakh" },
  { code: "194201", city: "Kargil", state: "Ladakh" },

  // Andaman & Nicobar Islands
  { code: "744101", city: "Port Blair", state: "Andaman & Nicobar Islands" },
  { code: "744103", city: "Port Blair", state: "Andaman & Nicobar Islands" },
  { code: "744201", city: "Diglipur", state: "Andaman & Nicobar Islands" },
  { code: "744301", city: "Car Nicobar", state: "Andaman & Nicobar Islands" },

  // Puducherry
  { code: "605001", city: "Puducherry", state: "Puducherry" },
  { code: "605005", city: "Puducherry", state: "Puducherry" },
  { code: "605006", city: "Puducherry", state: "Puducherry" },
  { code: "609001", city: "Karaikal", state: "Puducherry" },
  { code: "673639", city: "Mahe", state: "Puducherry" },

  // Dadra & Nagar Haveli and Daman & Diu
  { code: "396210", city: "Silvassa", state: "Dadra & Nagar Haveli" },
  { code: "396230", city: "Dadra", state: "Dadra & Nagar Haveli" },
  { code: "396220", city: "Daman", state: "Daman & Diu" },
  { code: "362520", city: "Diu", state: "Daman & Diu" },

  // Lakshadweep
  { code: "682555", city: "Kavaratti", state: "Lakshadweep" },
  { code: "682552", city: "Amini", state: "Lakshadweep" },
];

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const existing = await PincodeData.countDocuments();
  if (existing > 0) {
    console.log(`Collection already has ${existing} records. Upserting any new entries...`);
  }

  let inserted = 0;
  let skipped = 0;

  for (const entry of PINCODES) {
    const doc = {
      code:    entry.code,
      prefix4: entry.code.slice(0, 4),
      prefix3: entry.code.slice(0, 3),
      city:    entry.city,
      state:   entry.state,
      country: "India",
    };

    const result = await PincodeData.updateOne(
      { code: entry.code },
      { $set: doc },
      { upsert: true }
    );

    if (result.upsertedCount > 0) inserted++;
    else skipped++;
  }

  console.log(`Done. Inserted: ${inserted}, Already existed: ${skipped}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

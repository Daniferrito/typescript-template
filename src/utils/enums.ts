// BASE ENUMS
/** @public */
export enum ToastVariant {
  SUCCESS = "success",
  WARNING = "warning",
  ERROR = "error",
  INFO = "info",
}

/** @public */
export enum CrimeType {
  shoplift = "Shoplift",
  robStore = "Rob Store",
  mug = "Mug",
  larceny = "Larceny",
  dealDrugs = "Deal Drugs",
  bondForgery = "Bond Forgery",
  traffickArms = "Traffick Arms",
  homicide = "Homicide",
  grandTheftAuto = "Grand Theft Auto",
  kidnap = "Kidnap",
  assassination = "Assassination",
  heist = "Heist",
}

/** @public */
export enum FactionWorkType {
  hacking = "hacking",
  field = "field",
  security = "security",
}

/** @public */
export enum UniversityClassType {
  computerScience = "Computer Science",
  dataStructures = "Data Structures",
  networks = "Networks",
  algorithms = "Algorithms",
  management = "Management",
  leadership = "Leadership",
}

/** @public */
export enum GymType {
  strength = "str",
  defense = "def",
  dexterity = "dex",
  agility = "agi",
}

/** @public */
export enum JobName {
  software0 = "Software Engineering Intern",
  software1 = "Junior Software Engineer",
  software2 = "Senior Software Engineer",
  software3 = "Lead Software Developer",
  software4 = "Head of Software",
  software5 = "Head of Engineering",
  software6 = "Vice President of Technology",
  software7 = "Chief Technology Officer",
  IT0 = "IT Intern",
  IT1 = "IT Analyst",
  IT2 = "IT Manager",
  IT3 = "Systems Administrator",
  securityEng = "Security Engineer",
  networkEng0 = "Network Engineer",
  networkEng1 = "Network Administrator",
  business0 = "Business Intern",
  business1 = "Business Analyst",
  business2 = "Business Manager",
  business3 = "Operations Manager",
  business4 = "Chief Financial Officer",
  business5 = "Chief Executive Officer",
  security0 = "Security Guard",
  security1 = "Security Officer",
  security2 = "Security Supervisor",
  security3 = "Head of Security",
  agent0 = "Field Agent",
  agent1 = "Secret Agent",
  agent2 = "Special Operative",
  waiter = "Waiter",
  employee = "Employee",
  softwareConsult0 = "Software Consultant",
  softwareConsult1 = "Senior Software Consultant",
  businessConsult0 = "Business Consultant",
  businessConsult1 = "Senior Business Consultant",
  waiterPT = "Part-time Waiter",
  employeePT = "Part-time Employee",
}

/** @public */
export enum JobField {
  software = "Software",
  softwareConsultant = "Software Consultant",
  it = "IT",
  securityEngineer = "Security Engineer",
  networkEngineer = "Network Engineer",
  business = "Business",
  businessConsultant = "Business Consultant",
  security = "Security",
  agent = "Agent",
  employee = "Employee",
  partTimeEmployee = "Part-time Employee",
  waiter = "Waiter",
  partTimeWaiter = "Part-time Waiter",
}

// CORP ENUMS - Changed to types
/** @public */
export type CorpEmployeePosition =
  | "Operations"
  | "Engineer"
  | "Business"
  | "Management"
  | "Research & Development"
  | "Intern"
  | "Unassigned";

/** @public */
export type CorpIndustryName =
  | "Spring Water"
  | "Water Utilities"
  | "Agriculture"
  | "Fishing"
  | "Mining"
  | "Refinery"
  | "Restaurant"
  | "Tobacco"
  | "Chemical"
  | "Pharmaceutical"
  | "Computer Hardware"
  | "Robotics"
  | "Software"
  | "Healthcare"
  | "Real Estate";

/** @public */
export type CorpSmartSupplyOption = "leftovers" | "imports" | "none";

/** Names of all cities
 * @public */
export enum CityName {
  Aevum = "Aevum",
  Chongqing = "Chongqing",
  Sector12 = "Sector-12",
  NewTokyo = "New Tokyo",
  Ishima = "Ishima",
  Volhaven = "Volhaven",
}

/** Names of all locations
 * @public */
export enum LocationName {
  AevumAeroCorp = "AeroCorp",
  AevumBachmanAndAssociates = "Bachman & Associates",
  AevumClarkeIncorporated = "Clarke Incorporated",
  AevumCrushFitnessGym = "Crush Fitness Gym",
  AevumECorp = "ECorp",
  AevumFulcrumTechnologies = "Fulcrum Technologies",
  AevumGalacticCybersystems = "Galactic Cybersystems",
  AevumNetLinkTechnologies = "NetLink Technologies",
  AevumPolice = "Aevum Police Headquarters",
  AevumRhoConstruction = "Rho Construction",
  AevumSnapFitnessGym = "Snap Fitness Gym",
  AevumSummitUniversity = "Summit University",
  AevumWatchdogSecurity = "Watchdog Security",
  AevumCasino = "Iker Molina Casino",

  ChongqingKuaiGongInternational = "KuaiGong International",
  ChongqingSolarisSpaceSystems = "Solaris Space Systems",
  ChongqingChurchOfTheMachineGod = "Church of the Machine God",

  Sector12AlphaEnterprises = "Alpha Enterprises",
  Sector12BladeIndustries = "Blade Industries",
  Sector12CIA = "Central Intelligence Agency",
  Sector12CarmichaelSecurity = "Carmichael Security",
  Sector12CityHall = "Sector-12 City Hall",
  Sector12DeltaOne = "DeltaOne",
  Sector12FoodNStuff = "FoodNStuff",
  Sector12FourSigma = "Four Sigma",
  Sector12IcarusMicrosystems = "Icarus Microsystems",
  Sector12IronGym = "Iron Gym",
  Sector12JoesGuns = "Joe's Guns",
  Sector12MegaCorp = "MegaCorp",
  Sector12NSA = "National Security Agency",
  Sector12PowerhouseGym = "Powerhouse Gym",
  Sector12RothmanUniversity = "Rothman University",
  Sector12UniversalEnergy = "Universal Energy",

  NewTokyoDefComm = "DefComm",
  NewTokyoGlobalPharmaceuticals = "Global Pharmaceuticals",
  NewTokyoNoodleBar = "Noodle Bar",
  NewTokyoVitaLife = "VitaLife",
  NewTokyoArcade = "Arcade",

  IshimaNovaMedical = "Nova Medical",
  IshimaOmegaSoftware = "Omega Software",
  IshimaStormTechnologies = "Storm Technologies",
  IshimaGlitch = "0x6C1",

  VolhavenCompuTek = "CompuTek",
  VolhavenHeliosLabs = "Helios Labs",
  VolhavenLexoCorp = "LexoCorp",
  VolhavenMilleniumFitnessGym = "Millenium Fitness Gym",
  VolhavenNWO = "NWO",
  VolhavenOmniTekIncorporated = "OmniTek Incorporated",
  VolhavenOmniaCybersystems = "Omnia Cybersystems",
  VolhavenSysCoreSecurities = "SysCore Securities",
  VolhavenZBInstituteOfTechnology = "ZB Institute of Technology",

  Hospital = "Hospital",
  Slums = "The Slums",
  TravelAgency = "Travel Agency",
  WorldStockExchange = "World Stock Exchange",

  Void = "The Void",
}

/**
 * Locations of university
 *
 * @public
 */
export enum UniversityLocationName {
  AevumSummitUniversity = LocationName.AevumSummitUniversity,
  Sector12RothmanUniversity = LocationName.Sector12RothmanUniversity,
  VolhavenZBInstituteOfTechnology = LocationName.VolhavenZBInstituteOfTechnology,
}

/**
 * Locations of gym
 *
 * @public
 */
export enum GymLocationName {
  AevumCrushFitnessGym = LocationName.AevumCrushFitnessGym,
  AevumSnapFitnessGym = LocationName.AevumSnapFitnessGym,
  Sector12IronGym = LocationName.Sector12IronGym,
  Sector12PowerhouseGym = LocationName.Sector12PowerhouseGym,
  VolhavenMilleniumFitnessGym = LocationName.VolhavenMilleniumFitnessGym,
}

/** Names of all companies
 * @public */
export enum CompanyName {
  ECorp = "ECorp",
  MegaCorp = "MegaCorp",
  BachmanAndAssociates = "Bachman & Associates",
  BladeIndustries = "Blade Industries",
  NWO = "NWO",
  ClarkeIncorporated = "Clarke Incorporated",
  OmniTekIncorporated = "OmniTek Incorporated",
  FourSigma = "Four Sigma",
  KuaiGongInternational = "KuaiGong International",
  FulcrumTechnologies = "Fulcrum Technologies",
  StormTechnologies = "Storm Technologies",
  DefComm = "DefComm",
  HeliosLabs = "Helios Labs",
  VitaLife = "VitaLife",
  IcarusMicrosystems = "Icarus Microsystems",
  UniversalEnergy = "Universal Energy",
  GalacticCybersystems = "Galactic Cybersystems",
  AeroCorp = "AeroCorp",
  OmniaCybersystems = "Omnia Cybersystems",
  SolarisSpaceSystems = "Solaris Space Systems",
  DeltaOne = "DeltaOne",
  GlobalPharmaceuticals = "Global Pharmaceuticals",
  NovaMedical = "Nova Medical",
  CIA = "Central Intelligence Agency",
  NSA = "National Security Agency",
  WatchdogSecurity = "Watchdog Security",
  LexoCorp = "LexoCorp",
  RhoConstruction = "Rho Construction",
  AlphaEnterprises = "Alpha Enterprises",
  Police = "Aevum Police Headquarters",
  SysCoreSecurities = "SysCore Securities",
  CompuTek = "CompuTek",
  NetLinkTechnologies = "NetLink Technologies",
  CarmichaelSecurity = "Carmichael Security",
  FoodNStuff = "FoodNStuff",
  JoesGuns = "Joe's Guns",
  OmegaSoftware = "Omega Software",
  NoodleBar = "Noodle Bar",
}

/**
 * Names of all factions.
 *
 * Warning: Spoiler ahead. This enum contains names of **all** factions. If you do not want to know what all the
 * factions are, you should not check this enum. Some factions are only accessible in the endgame.
 *
 * @public */
export enum FactionName {
  Illuminati = "Illuminati",
  Daedalus = "Daedalus",
  TheCovenant = "The Covenant",
  ECorp = "ECorp",
  MegaCorp = "MegaCorp",
  BachmanAssociates = "Bachman & Associates",
  BladeIndustries = "Blade Industries",
  NWO = "NWO",
  ClarkeIncorporated = "Clarke Incorporated",
  OmniTekIncorporated = "OmniTek Incorporated",
  FourSigma = "Four Sigma",
  KuaiGongInternational = "KuaiGong International",
  FulcrumSecretTechnologies = "Fulcrum Secret Technologies",
  BitRunners = "BitRunners",
  TheBlackHand = "The Black Hand",
  NiteSec = "NiteSec",
  Aevum = "Aevum",
  Chongqing = "Chongqing",
  Ishima = "Ishima",
  NewTokyo = "New Tokyo",
  Sector12 = "Sector-12",
  Volhaven = "Volhaven",
  SpeakersForTheDead = "Speakers for the Dead",
  TheDarkArmy = "The Dark Army",
  TheSyndicate = "The Syndicate",
  Silhouette = "Silhouette",
  Tetrads = "Tetrads",
  SlumSnakes = "Slum Snakes",
  Netburners = "Netburners",
  TianDiHui = "Tian Di Hui",
  CyberSec = "CyberSec",
  Bladeburners = "Bladeburners",
  ChurchOfTheMachineGod = "Church of the Machine God",
  ShadowsOfAnarchy = "Shadows of Anarchy",
}
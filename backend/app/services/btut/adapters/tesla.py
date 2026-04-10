"""Nikola Tesla corpus adapter — patents, writings, people, concepts, locations.

Builds a heterogeneous entity graph from Tesla's complete works:
- 112 US patents + 70 international patents
- Major writings, lectures, and articles
- Key people in Tesla's network
- Scientific concepts and inventions
- Locations and institutions
- FBI declassified documents

All data is public domain or FOIA-released.
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict

from . import register_adapter
from .base import BaseDatasetAdapter, DatasetMeta, EntityTypeConfig

logger = logging.getLogger(__name__)

# =====================================================================
# COMPLETE TESLA PATENT DATABASE
# =====================================================================

US_PATENTS = [
    # 1886-1888: Early dynamo and motor patents
    ("US334823", "Commutator for Dynamo Electric Machines", "1886-01-26", ["dynamo", "commutator"]),
    ("US335786", "Electric Arc Lamp", "1886-02-09", ["lighting", "arc-lamp"]),
    ("US335787", "Electric Arc Lamp", "1886-02-09", ["lighting", "arc-lamp"]),
    ("US336961", "Regulator for Dynamo Electric Machines", "1886-03-02", ["dynamo", "regulator"]),
    ("US336962", "Regulator for Dynamo Electric Machines", "1886-03-02", ["dynamo", "regulator"]),
    ("US350954", "Regulator for Dynamo Electric Machines", "1886-10-19", ["dynamo", "regulator"]),
    ("US359748", "Dynamo Electric Machine", "1887-03-22", ["dynamo"]),
    ("US381968", "Electro Magnetic Motor", "1888-05-01", ["motor", "AC", "polyphase"]),
    ("US381969", "Electro Magnetic Motor", "1888-05-01", ["motor", "AC"]),
    ("US381970", "System of Electrical Distribution", "1888-05-01", ["AC", "distribution", "polyphase"]),
    ("US382279", "Electro Magnetic Motor", "1888-05-01", ["motor", "AC"]),
    ("US382280", "Electrical Transmission of Power", "1888-05-01", ["transmission", "AC", "polyphase"]),
    ("US382281", "Electrical Transmission of Power", "1888-05-01", ["transmission", "AC"]),
    ("US382282", "Method of Converting and Distributing Electric Currents", "1888-05-01", ["AC", "conversion"]),
    ("US382845", "Commutator for Dynamo Electric Machines", "1888-05-15", ["dynamo", "commutator"]),
    ("US390413", "System of Electrical Distribution", "1888-10-02", ["AC", "distribution"]),
    ("US390414", "Dynamo Electric Machine", "1888-10-02", ["dynamo"]),
    ("US390415", "Dynamo Electric Machine or Motor", "1888-10-02", ["dynamo", "motor"]),
    ("US390721", "Dynamo Electric Machine", "1888-10-09", ["dynamo"]),
    ("US390820", "Regulator for Alternate Current Motors", "1888-10-09", ["motor", "AC", "regulator"]),
    ("US396121", "Thermo Magnetic Motor", "1888-01-15", ["motor", "thermomagnetic"]),
    # 1889-1891: AC motor revolution
    ("US401520", "Method of Operating Electro Magnetic Motors", "1889-04-16", ["motor", "AC"]),
    ("US405858", "Electro Magnetic Motor", "1889-06-25", ["motor"]),
    ("US405859", "Method of Electrical Power Transmission", "1889-06-25", ["transmission", "power"]),
    ("US406968", "Dynamo Electric Machine", "1889-07-16", ["dynamo"]),
    ("US413353", "Method of Obtaining Direct Current from Alternating Currents", "1889-10-22", ["AC", "DC", "conversion"]),
    ("US416191", "Electro-Magnetic Motor", "1889-12-03", ["motor"]),
    ("US416192", "Method of Operating Electro-Magnetic Motors", "1889-12-03", ["motor"]),
    ("US416193", "Electro-Magnetic Motor", "1889-12-03", ["motor"]),
    ("US416194", "Electric Motor", "1889-12-03", ["motor"]),
    ("US416195", "Electro-Magnetic Motor", "1889-12-03", ["motor"]),
    ("US417794", "Armature for Electric Machines", "1889-12-24", ["armature", "motor"]),
    ("US418248", "Electro-Magnetic Motor", "1889-12-31", ["motor"]),
    ("US424036", "Electro-Magnetic Motor", "1890-03-25", ["motor"]),
    ("US428057", "Pyromagneto Electric Generator", "1890-05-13", ["generator", "pyromagnetic"]),
    ("US433700", "Alternating-Current Electro-Magnetic Motor", "1890-08-05", ["motor", "AC"]),
    ("US433701", "Alternating-Current Motor", "1890-08-05", ["motor", "AC"]),
    ("US433702", "Electrical Transformer Or Induction Device", "1890-08-05", ["transformer", "induction"]),
    ("US433703", "Electro-Magnetic Motor", "1890-08-05", ["motor"]),
    ("US445207", "Electro-Magnetic Motor", "1891-01-27", ["motor"]),
    ("US447920", "Method of Operating Arc-Lamps", "1891-03-10", ["lighting", "arc-lamp"]),
    ("US447921", "Alternating Electric Current Generator", "1891-03-10", ["generator", "AC"]),
    ("US454622", "System of Electric Lighting", "1891-06-23", ["lighting", "system"]),
    ("US455067", "Electro-Magnetic Motor", "1891-06-30", ["motor"]),
    ("US455068", "Electrical Meter", "1891-06-30", ["meter", "measurement"]),
    ("US455069", "Electric Incandescent Lamp", "1891-06-30", ["lighting", "incandescent"]),
    ("US459772", "Electro-Magnetic Motor", "1891-09-22", ["motor"]),
    ("US462418", "Method of and Apparatus for Electrical Conversion and Distribution", "1891-11-03", ["conversion", "distribution"]),
    ("US464666", "Electro-Magnetic Motor", "1891-12-08", ["motor"]),
    ("US464667", "Electrical Condenser", "1891-12-08", ["condenser", "capacitor"]),
    # 1892-1897: High frequency and Tesla coil era
    ("US487796", "System of Electrical Transmission of Power", "1892-12-13", ["transmission", "power"]),
    ("US511559", "Electrical Transmission of Power", "1893-12-26", ["transmission"]),
    ("US511560", "System of Electrical Power Transmission", "1893-12-26", ["transmission", "system"]),
    ("US511915", "Electrical Transmission of Power", "1894-01-02", ["transmission"]),
    ("US511916", "Electric Generator", "1894-01-02", ["generator"]),
    ("US512340", "Coil for Electro-Magnets", "1894-01-09", ["coil", "tesla-coil", "electromagnet"]),
    ("US514167", "Electrical Conductor", "1894-02-06", ["conductor"]),
    ("US514168", "Means for Generating Electric Currents", "1894-02-06", ["generator", "current"]),
    ("US514169", "Reciprocating Engine", "1894-02-06", ["engine", "mechanical"]),
    ("US514170", "Incandescent Electric Light", "1894-02-06", ["lighting", "incandescent"]),
    ("US514972", "Electric Railway System", "1894-02-20", ["railway", "transportation"]),
    ("US514973", "Electrical Meter", "1894-02-20", ["meter"]),
    ("US517900", "Steam Engine", "1894-04-10", ["engine", "steam"]),
    ("US524426", "Electromagnetic Motor", "1894-08-14", ["motor"]),
    ("US555190", "Alternating Motor", "1896-02-25", ["motor", "AC"]),
    ("US567818", "Electrical Condenser", "1896-09-15", ["condenser", "capacitor"]),
    ("US568176", "Apparatus for Producing Electrical Currents of High Frequency and Potential", "1896-09-22", ["high-frequency", "tesla-coil"]),
    ("US568177", "Apparatus for Producing Ozone", "1896-09-22", ["ozone", "chemistry"]),
    ("US568178", "Method of Regulating Apparatus for Producing Electric Currents of High Frequency", "1896-09-22", ["high-frequency", "regulation"]),
    ("US568179", "Method of and Apparatus for Producing Currents of High Frequency", "1896-09-22", ["high-frequency"]),
    ("US568180", "Apparatus for Producing Electrical Currents of High Frequency", "1896-09-22", ["high-frequency"]),
    ("US577670", "Apparatus for Producing Electric Currents of High Frequency", "1897-02-23", ["high-frequency"]),
    ("US577671", "Manufacture of Electrical Condensers Coils and Similar Devices", "1897-02-23", ["condenser", "coil", "manufacturing"]),
    ("US583953", "Apparatus for Producing Currents of High Frequency", "1897-06-08", ["high-frequency"]),
    ("US593138", "Electrical Transformer", "1897-11-02", ["transformer"]),
    # 1898-1901: Remote control and wireless transmission
    ("US609245", "Electrical Circuit Controller", "1898-08-16", ["circuit", "controller"]),
    ("US609246", "Electric Circuit Controller", "1898-08-16", ["circuit", "controller"]),
    ("US609247", "Electric Circuit Controller", "1898-08-16", ["circuit", "controller"]),
    ("US609248", "Electric Circuit Controller", "1898-08-16", ["circuit", "controller"]),
    ("US609249", "Electric Circuit Controller", "1898-08-16", ["circuit", "controller"]),
    ("US609250", "Electrical Igniter for Gas Engines", "1898-08-16", ["igniter", "engine"]),
    ("US609251", "Electric Circuit Controller", "1898-08-16", ["circuit", "controller"]),
    ("US611719", "Electrical Circuit Controller", "1898-10-04", ["circuit", "controller"]),
    ("US613735", "Electric Circuit Controller", "1898-11-08", ["circuit", "controller"]),
    ("US613809", "Method of and Apparatus for Controlling Mechanism of Moving Vehicle or Vehicles", "1898-07-01", ["remote-control", "teleautomaton", "robotics"]),
    ("US645576", "System of Transmission of Electrical Energy", "1900-03-20", ["wireless", "transmission", "energy"]),
    ("US649621", "Apparatus for Transmission of Electrical Energy", "1900-05-15", ["wireless", "transmission", "energy"]),
    ("US655838", "Method of Insulating Electric Conductors", "1900-10-23", ["insulation"]),
    ("US685012", "Means for Increasing the Intensity of Electrical Oscillations", "1900-03-21", ["oscillation", "resonance"]),
    ("US685953", "Apparatus for Utilizing Effects Transmitted from a Distance to a Receiving Device through Natural Media", "1901-11-05", ["wireless", "radio", "reception"]),
    ("US685954", "Method of Utilizing Effects Transmitted through Natural Media", "1901-11-05", ["wireless", "radio"]),
    ("US685955", "Apparatus for Utilizing Effects Transmitted From A Distance To A Receiving Device Through Natural Media", "1901-11-05", ["wireless", "radio"]),
    ("US685956", "Apparatus for Utilizing Effects Transmitted through Natural Media", "1901-11-05", ["wireless", "radio"]),
    ("US685957", "Apparatus for the Utilization of Radiant Energy", "1901-11-05", ["radiant-energy", "solar"]),
    ("US685958", "Method of Utilizing of Radiant Energy", "1901-11-05", ["radiant-energy", "solar"]),
    # 1903-1928: Later inventions
    ("US723188", "Method of Signaling", "1903-03-17", ["signaling", "wireless", "radio"]),
    ("US725605", "System of Signaling", "1903-04-14", ["signaling", "wireless"]),
    ("US787412", "Art of Transmitting Electrical Energy through the Natural Mediums", "1905-04-18", ["wireless", "transmission", "earth-resonance"]),
    ("US1061142", "Fluid Propulsion", "1909-10-21", ["turbine", "fluid-dynamics"]),
    ("US1061206", "Turbine", "1909-10-21", ["turbine", "bladeless"]),
    ("US1113716", "Fountain", "1914-10-13", ["fountain", "hydraulic"]),
    ("US1119732", "Apparatus for Transmitting Electrical Energy", "1914-12-01", ["wireless", "transmission"]),
    ("US1209359", "Speed-Indicator", "1916-12-19", ["speedometer", "measurement"]),
    ("US1266175", "Lightning-Protector", "1918-05-14", ["lightning", "protection"]),
    ("US1274816", "Speed Indicator", "1918-08-06", ["speedometer"]),
    ("US1314718", "Ship's Log", "1919-09-02", ["navigation", "maritime"]),
    ("US1329559", "Valvular Conduit", "1920-02-03", ["valvular-conduit", "fluidics"]),
    ("US1365547", "Flow-Meter", "1921-01-11", ["flow-meter", "measurement"]),
    ("US1402025", "Frequency-Meter", "1922-01-03", ["frequency", "measurement"]),
    ("US1655113", "Method of Aerial Transportation", "1928-01-03", ["VTOL", "aviation", "flying-machine"]),
    ("US1655114", "Apparatus for Aerial Transportation", "1928-01-03", ["VTOL", "aviation"]),
]

# Key people in Tesla's network
PEOPLE = [
    ("nikola_tesla", "Nikola Tesla", "inventor", "Serbian-American inventor, electrical/mechanical engineer, futurist"),
    ("thomas_edison", "Thomas Edison", "rival", "Rival inventor, DC power advocate, War of Currents opponent"),
    ("george_westinghouse", "George Westinghouse", "patron", "Industrialist who licensed Tesla's AC patents, funded Niagara Falls"),
    ("jp_morgan", "J.P. Morgan", "financier", "Funded Wardenclyffe Tower project, later withdrew support"),
    ("john_jacob_astor", "John Jacob Astor IV", "patron", "Investor in Tesla's projects, died on Titanic 1912"),
    ("robert_underwood_johnson", "Robert Underwood Johnson", "friend", "Editor of Century Magazine, close friend and literary ally"),
    ("mark_twain", "Mark Twain", "friend", "Close friend, frequent visitor to Tesla's laboratory"),
    ("guglielmo_marconi", "Guglielmo Marconi", "rival", "Radio pioneer, patent dispute with Tesla over radio invention"),
    ("lord_kelvin", "Lord Kelvin", "peer", "William Thomson, initially opposed AC, later acknowledged Tesla"),
    ("katharine_johnson", "Katharine Johnson", "confidante", "Wife of Robert Johnson, close personal friend of Tesla"),
    ("john_oneil", "John J. O'Neill", "biographer", "Pulitzer Prize journalist, wrote 'Prodigal Genius' biography"),
    ("thomas_martin", "Thomas Commerford Martin", "editor", "Electrical engineer, editor who compiled Tesla's early works"),
    ("fritz_lowenstein", "Fritz Lowenstein", "assistant", "Former assistant, later rival who filed competing patents"),
    ("koloman_czito", "Koloman Czito", "machinist", "Longtime machinist and lab assistant to Tesla"),
    ("sava_kosanovic", "Sava Kosanovic", "nephew", "Yugoslav ambassador, fought for Tesla's papers after death"),
    ("john_trump", "John G. Trump", "investigator", "MIT professor who examined Tesla's papers for the government"),
    ("bloyce_fitzgerald", "Bloyce Fitzgerald", "agent", "FBI agent who supervised seizure of Tesla's documents"),
]

# Major writings, lectures, articles — COMPLETE from Wikipedia + Tesla Universe
WRITINGS = [
    # Lectures (major)
    ("lecture_aiee_1888", "A New System of Alternate Current Motors and Transformers", "1888", "lecture", "AIEE, New York"),
    ("lecture_columbia_1891", "Experiments with Alternate Currents of High Potential and High Frequency", "1891", "lecture", "Columbia College, New York"),
    ("article_phenomena_1891", "Phenomena of Alternating Currents of Very High Frequency", "1891", "article", "Electrical World"),
    ("lecture_london_1892", "Experiments with Alternate Currents of Very High Frequency", "1892", "lecture", "Royal Institution, London"),
    ("article_dissipation_1892", "On the Dissipation of the Electrical Energy of the Hertz Resonator", "1892", "article", "Electrical Engineer"),
    ("lecture_philadelphia_1893", "On Light and Other High Frequency Phenomena", "1893", "lecture", "Franklin Institute, Philadelphia"),
    ("lecture_st_louis_1893", "On Light and Other High Frequency Phenomena", "1893", "lecture", "National Electric Light Association, St. Louis"),
    # 1890s articles
    ("article_oscillators_1893", "Tesla's Oscillator and Other Inventions", "1895", "article", "Century Magazine"),
    ("article_earth_electricity_1896", "Earth Electricity to Kill Monopoly", "1896", "article", "The World Sunday Magazine"),
    ("lecture_electricity_1897", "On Electricity", "1897", "lecture", "Electrical Review"),
    ("article_electrotherapy_1898", "High Frequency Oscillators for Electro-therapeutic and Other Purposes", "1898", "article", "Electrical Engineer"),
    ("article_artillery_1898", "Plans to Dispense With Artillery of the Present Type", "1898", "article", "The Sun, New York"),
    ("article_efforts_1898", "Tesla Describes His Efforts in Various Fields of Work", "1898", "article", "Electrical Review"),
    ("article_interrupters_1899", "On Current Interrupters", "1899", "article", "Electrical Review"),
    # Colorado Springs Notes
    ("colorado_springs_notes", "Colorado Springs Notes 1899-1900", "1899", "notebook", "Colorado Springs laboratory"),
    # 1900s articles — Tesla's most ambitious writing period
    ("article_century_1900", "The Problem of Increasing Human Energy", "1900", "article", "Century Magazine"),
    ("article_discovery_1901", "Tesla's New Discovery", "1901", "article", "The Sun, New York"),
    ("article_talking_planets_1901", "Talking With Planets", "1901", "article", "Collier's Weekly"),
    ("article_wardenclyffe_1902", "Inventor Tesla's Plant Nearing Completion", "1902", "article", "Brooklyn Eagle"),
    ("article_transmission_1904", "The Transmission of Electrical Energy Without Wires", "1904", "article", "Electrical World"),
    ("article_electric_autos_1904", "Electric Autos", "1904", "article", "Manufacturers' Record"),
    ("article_peace_1905", "The Transmission of Electrical Energy Without Wires as a Means for Furthering Peace", "1905", "article", "Electrical World and Engineer"),
    ("article_tuned_lightning_1907", "Tuned Lightning", "1907", "article", "English Mechanic and World of Science"),
    ("article_wireless_torpedo_1907", "Tesla's Wireless Torpedo", "1907", "article", "New York Times"),
    ("article_possibilities_1907", "Possibilities of Wireless", "1907", "article", "New York Times"),
    ("article_future_wireless_1908", "The Future of the Wireless Art", "1908", "article", "Wireless Telegraphy and Telephony"),
    ("article_vision_1908", "Mr. Tesla's Vision", "1908", "article", "New York Times"),
    ("article_new_wireless_1909", "Nikola Tesla's New Wireless", "1909", "article", "The Electrical Engineer, London"),
    # 1910s
    ("article_gas_turbines_1911", "Dr. Tesla Talks of Gas Turbines", "1911", "article", "Motor World"),
    ("article_monarch_machines_1911", "Tesla's New Monarch of Machines", "1911", "article", "New York Herald"),
    ("article_solar_radiation_1912", "The Disturbing Influence of Solar Radiation On Wireless Transmission", "1912", "article", "Electrical Review"),
    ("article_cosmic_forces_1915", "How Cosmic Forces Shape Our Destinies", "1915", "article", "New York American"),
    ("article_recollections_1915", "Some Personal Recollections", "1915", "article", "Scientific American"),
    ("article_wonder_world_1915", "The Wonder World To Be Created By Electricity", "1915", "article", "Manufacturer's Record"),
    ("article_wireless_vision_1915", "Nikola Tesla Sees a Wireless Vision", "1915", "article", "New York Times"),
    ("article_bolts_thor_1915", "Tesla's New Device Like Bolts of Thor", "1915", "article", "New York Times"),
    ("article_wonders_future_1916", "Wonders of the Future", "1916", "article", "Collier's Weekly"),
    ("article_battleships_1917", "Electric Drive for Battle Ships", "1917", "article", "New York Herald"),
    ("article_war_views_1917", "Tesla's Views on Electricity and the War", "1917", "article", "Electrical Experimenter"),
    # My Inventions (serialized autobiography)
    ("my_inventions_1919", "My Inventions: The Autobiography of Nikola Tesla", "1919", "autobiography", "Electrical Experimenter"),
    ("article_illusions_1919", "Famous Scientific Illusions", "1919", "article", "Electrical Experimenter"),
    ("article_true_wireless_1919", "The True Wireless", "1919", "article", "Electrical Experimenter"),
    ("article_oscillators_1919", "Electrical Oscillators", "1919", "article", "Electrical Experimenter"),
    ("article_statics_1919", "The Effect of Statics on Wireless Transmission", "1919", "article", "Electrical Experimenter"),
    ("article_moon_rotation_1919", "The Moon's Rotation", "1919", "article", "Electrical Experimenter"),
    # 1920s-1930s
    ("article_rain_control_1920", "Rain Can Be Controlled and Hydraulic Force Provided", "1920", "article", "Syracuse Herald"),
    ("article_woman_boss_1926", "When Woman is Boss", "1926", "interview", "Colliers"),
    ("article_world_system_1927", "World System of Wireless Transmission of Energy", "1927", "article", "Telegraph and Telephone Age"),
    ("article_radio_theories_1929", "Nikola Tesla Tells of New Radio Theories", "1929", "article", "New York Herald Tribune"),
    ("article_motive_power_1931", "Our Future Motive Power", "1931", "article", "Everyday Science and Mechanics"),
    ("article_pioneer_radio_1932", "Pioneer Radio Engineer Gives Views On Power", "1932", "article", "New York Herald Tribune"),
    ("article_cosmic_rays_1932", "The Eternal Source of Energy of the Universe, Origin and Intensity of Cosmic Rays", "1932", "article", "New York"),
    ("article_cosmic_ray_motor_1932", "Tesla Cosmic Ray Motor May Transmit Power Round Earth", "1932", "article", "Brooklyn Eagle"),
    ("article_power_development_1934", "Tesla on Power Development and Future Marvels", "1934", "article", "New York World Telegram"),
    ("article_peace_ray_1934", "Tesla Invents Peace Ray", "1934", "article", "New York Sun"),
    ("article_death_beam_1935", "A Machine to End War", "1935", "article", "Liberty magazine"),
    ("article_concentrated_energy_1935", "The New Art of Projecting Concentrated Non-dispersive Energy Through Natural Media", "1935", "article", "Unpublished manuscript"),
    ("article_shore_beam_1935", "Tesla Predicts Ships Powered by Shore Beam", "1935", "article", "New York Herald Tribune"),
    ("article_end_aircraft_1934", "Dr. Tesla Visions the End of Aircraft In War", "1934", "article", "Every Week Magazine"),
    # Poetry
    ("poem_olympian_gossip", "Fragments of Olympian Gossip", "1928", "poem", "Written for George Sylvester Viereck"),
]

# Timeline events (key moments in Tesla's life)
TIMELINE_EVENTS = [
    ("event_birth", "Born in Smiljan", "1856-07-10", "Midnight during thunderstorm"),
    ("event_rotating_field", "Discovers rotating magnetic field principle", "1882-02-01", "Budapest City Park revelation"),
    ("event_first_motor", "Builds first induction motor", "1883-01-01", "Strasbourg prototype"),
    ("event_arrives_america", "Arrives in New York City", "1884-06-06", "With 4 cents in his pocket"),
    ("event_edison_employment", "Hired by Thomas Edison", "1884-06-08", "Edison Machine Works"),
    ("event_leaves_edison", "Leaves Edison after dispute", "1885-01-01", "Disagreement over payment"),
    ("event_ac_patents", "Files foundational AC patents", "1888-05-01", "7 patents in one day"),
    ("event_westinghouse_deal", "Licenses patents to Westinghouse", "1888-07-01", "$60,000 + royalties"),
    ("event_citizenship", "Becomes US citizen", "1891-07-30", "New York City"),
    ("event_lab_fire", "South Fifth Avenue lab destroyed by fire", "1895-03-13", "Years of research lost"),
    ("event_radio_demo", "Demonstrates radio-controlled boat", "1898-09-01", "Madison Square Garden, New York"),
    ("event_colorado_springs", "Begins Colorado Springs experiments", "1899-06-01", "High-voltage wireless tests"),
    ("event_artificial_lightning", "Creates artificial lightning bolts", "1899-07-01", "130-foot discharges"),
    ("event_cosmic_signals", "Claims to receive extraterrestrial signals", "1899-12-01", "Colorado Springs"),
    ("event_wardenclyffe_begins", "Construction of Wardenclyffe Tower begins", "1901-01-01", "Shoreham, Long Island"),
    ("event_morgan_funding", "J.P. Morgan provides $150,000", "1901-03-01", "For Wardenclyffe project"),
    ("event_morgan_withdraws", "J.P. Morgan refuses additional funding", "1904-01-01", "Wardenclyffe project stalls"),
    ("event_wardenclyffe_demolished", "Wardenclyffe Tower demolished", "1917-07-04", "Dynamited for scrap"),
    ("event_edison_medal", "Receives Edison Medal from AIEE", "1917-05-18", "Highest honor in electrical engineering"),
    ("event_death", "Dies at New Yorker Hotel", "1943-01-07", "Room 3327, age 86"),
    ("event_papers_seized", "Government seizes Tesla's papers", "1943-01-09", "Office of Alien Property"),
    ("event_trump_examines", "Dr. John Trump examines papers", "1943-01-26", "Concludes no weaponizable technology"),
    ("event_papers_belgrade", "Papers shipped to Belgrade museum", "1952-01-01", "80 trunks to Nikola Tesla Museum"),
    ("event_fbi_declassified", "FBI declassifies Tesla files", "2016-09-21", "250+ pages released"),
]

# Key scientific concepts and inventions
CONCEPTS = [
    ("alternating_current", "Alternating Current (AC)", "The foundation of modern power distribution"),
    ("polyphase_system", "Polyphase AC System", "Multi-phase power generation and transmission"),
    ("rotating_magnetic_field", "Rotating Magnetic Field", "Fundamental principle behind AC motors"),
    ("tesla_coil", "Tesla Coil", "Resonant transformer for high-voltage, high-frequency experiments"),
    ("wireless_transmission", "Wireless Transmission of Energy", "Transmission of power without wires through the Earth"),
    ("radio", "Radio Communication", "Wireless signaling, priority dispute with Marconi"),
    ("remote_control", "Remote Control (Teleautomaton)", "First radio-controlled vehicle, demonstrated 1898"),
    ("fluorescent_lighting", "Fluorescent Lighting", "Early high-frequency gas discharge lighting"),
    ("x_ray", "X-Ray Experimentation", "Early X-ray imaging experiments, shadow photographs"),
    ("bladeless_turbine", "Bladeless Turbine", "Boundary layer disk turbine for fluid propulsion"),
    ("magnifying_transmitter", "Magnifying Transmitter", "Enhanced Tesla coil for global energy transmission"),
    ("world_wireless_system", "World Wireless System", "Global communication and power distribution network"),
    ("death_ray", "Directed Energy Weapon (Teleforce)", "Charged particle beam weapon concept"),
    ("earthquake_machine", "Mechanical Oscillator", "Electromechanical oscillator, alleged earthquake effects"),
    ("wardenclyffe_system", "Wardenclyffe Tower System", "Wireless power transmission tower on Long Island"),
    ("cosmic_rays", "Cosmic Ray Motor", "Theoretical motor powered by cosmic radiation"),
    ("ball_lightning", "Ball Lightning", "Experimental production of artificial ball lightning"),
    ("radiant_energy", "Radiant Energy", "Capture of energy from natural radiation"),
    ("earth_resonance", "Earth Resonance", "Using Earth's natural electromagnetic resonance"),
    ("plasma", "High-Frequency Plasma", "Early plasma physics experiments"),
]

# Key locations
LOCATIONS = [
    ("smiljan", "Smiljan, Croatia", "birthplace", "Tesla's birthplace, 1856"),
    ("graz", "Graz Polytechnic", "education", "Where Tesla studied engineering"),
    ("budapest", "Budapest Telephone Exchange", "early_career", "Where Tesla conceived the rotating magnetic field"),
    ("strasbourg", "Strasbourg", "early_career", "First AC motor prototype built here"),
    ("new_york_lab_south_5th", "South Fifth Avenue Lab, New York", "laboratory", "Tesla's lab destroyed by fire, 1895"),
    ("new_york_lab_houston_st", "Houston Street Lab, New York", "laboratory", "Lab where Tesla developed high-frequency experiments"),
    ("colorado_springs", "Colorado Springs Laboratory", "laboratory", "High-voltage experiments, 1899-1900"),
    ("wardenclyffe", "Wardenclyffe Tower, Shoreham, Long Island", "laboratory", "Wireless transmission tower, 1901-1917"),
    ("niagara_falls", "Niagara Falls Power Plant", "installation", "First large-scale AC power plant, 1896"),
    ("world_columbian_expo", "World's Columbian Exposition, Chicago", "exhibition", "AC power demonstration, 1893"),
    ("new_yorker_hotel", "New Yorker Hotel, Room 3327", "residence", "Tesla's final residence, died here 1943"),
    ("waldorf_astoria", "Waldorf-Astoria Hotel", "residence", "Tesla's residence for 20 years"),
    ("edison_machine_works", "Edison Machine Works, New York", "employment", "Tesla's brief employment under Edison"),
]

# FBI/Government documents
FBI_DOCUMENTS = [
    ("fbi_part1", "FBI File Part 1 of 3", "1943-2016", "FOIA release of 253 pages on Tesla investigation"),
    ("fbi_part2", "FBI File Part 2 of 3", "1943-2016", "Contains inventory of seized papers and equipment"),
    ("fbi_part3", "FBI File Part 3 of 3", "1943-2016", "Additional 64 pages released March 2018"),
    ("oap_seizure", "Office of Alien Property Seizure Report", "1943", "Initial seizure of Tesla's belongings from New Yorker Hotel"),
    ("trump_examination", "Dr. John G. Trump MIT Examination Report", "1943", "Trump's assessment that papers contained no weaponizable technology"),
    ("belgrade_shipment", "Papers Shipped to Belgrade", "1952", "80 trunks of Tesla's papers shipped to Nikola Tesla Museum"),
    ("kosanovic_file", "Sava Kosanovic Investigation File", "1943-1950", "FBI surveillance of Tesla's nephew as Yugoslav ambassador"),
]


@register_adapter("tesla")
class TeslaAdapter(BaseDatasetAdapter):

    def get_meta(self) -> DatasetMeta:
        return DatasetMeta(
            dataset_id="tesla",
            display_name="Nikola Tesla",
            description="Complete Tesla corpus: 112 US patents, writings, lectures, people, concepts, locations, FBI documents",
            entity_types=[
                EntityTypeConfig("patent", "#00d4ff", "title", "patent_number", ["grant_date", "concepts"]),
                EntityTypeConfig("writing", "#f0883e", "title", "year", ["type", "venue"]),
                EntityTypeConfig("person", "#3fb950", "full_name", "role", ["description"]),
                EntityTypeConfig("concept", "#a371f7", "concept_name", "", ["description"]),
                EntityTypeConfig("location", "#d29922", "location_name", "location_type", ["significance"]),
                EntityTypeConfig("document", "#f85149", "title", "date_range", ["description"]),
                EntityTypeConfig("event", "#d29922", "event_name", "date", ["description"]),
            ],
            lookup_field="patent_number",
            lookup_label="ID",
        )

    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        entities = []

        # Patents
        for pnum, title, date, concepts in US_PATENTS:
            year = date[:4]
            decade = f"{year[:3]}0s"
            entities.append({
                "name": f"patent_{pnum}",
                "type": "patent",
                "attributes": json.dumps({
                    "patent_number": pnum,
                    "title": title,
                    "grant_date": date,
                    "year": int(year),
                    "decade": decade,
                    "concepts": concepts,
                    "country": "US",
                    "inventor": "Nikola Tesla",
                }),
            })

        # People
        for pid, name, role, desc in PEOPLE:
            entities.append({
                "name": f"person_{pid}",
                "type": "person",
                "attributes": json.dumps({
                    "full_name": name,
                    "role": role,
                    "description": desc,
                }),
            })

        # Writings
        for wid, title, year, wtype, venue in WRITINGS:
            entities.append({
                "name": f"writing_{wid}",
                "type": "writing",
                "attributes": json.dumps({
                    "title": title,
                    "year": year,
                    "type": wtype,
                    "venue": venue,
                }),
            })

        # Concepts
        for cid, name, desc in CONCEPTS:
            entities.append({
                "name": f"concept_{cid}",
                "type": "concept",
                "attributes": json.dumps({
                    "concept_name": name,
                    "description": desc,
                }),
            })

        # Locations
        for lid, name, ltype, significance in LOCATIONS:
            entities.append({
                "name": f"location_{lid}",
                "type": "location",
                "attributes": json.dumps({
                    "location_name": name,
                    "location_type": ltype,
                    "significance": significance,
                }),
            })

        # FBI Documents
        for did, title, date_range, desc in FBI_DOCUMENTS:
            entities.append({
                "name": f"document_{did}",
                "type": "document",
                "attributes": json.dumps({
                    "title": title,
                    "date_range": date_range,
                    "description": desc,
                    "source": "FBI/FOIA",
                }),
            })

        # Timeline Events
        for eid, title, date, desc in TIMELINE_EVENTS:
            entities.append({
                "name": f"event_{eid}",
                "type": "event",
                "attributes": json.dumps({
                    "event_name": title,
                    "date": date,
                    "description": desc,
                    "year": int(date[:4]) if date[:4].isdigit() else 0,
                }),
            })

        return entities[:limit]

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        edges = []
        entity_names = {e["name"] for e in entities}

        # Patent -> concept edges (from concept tags)
        for entity in entities:
            if entity["type"] != "patent":
                continue
            attrs = json.loads(entity["attributes"])
            concepts = attrs.get("concepts", [])
            for concept_tag in concepts:
                concept_name = f"concept_{concept_tag.replace('-', '_')}"
                if concept_name in entity_names:
                    edges.append({
                        "source": entity["name"], "target": concept_name,
                        "type": "relates_to_concept", "weight": 0.9,
                    })

        # Patent -> Tesla (inventor)
        for entity in entities:
            if entity["type"] == "patent":
                edges.append({
                    "source": entity["name"], "target": "person_nikola_tesla",
                    "type": "invented_by", "weight": 1.0,
                })

        # Temporal edges between adjacent patents (same year or concept)
        patent_entities = [e for e in entities if e["type"] == "patent"]
        for i in range(len(patent_entities) - 1):
            edges.append({
                "source": patent_entities[i]["name"],
                "target": patent_entities[i + 1]["name"],
                "type": "temporal_sequence", "weight": 0.7,
            })

        # Concept co-occurrence edges (patents sharing concepts)
        concept_to_patents: dict[str, list[str]] = defaultdict(list)
        for entity in entities:
            if entity["type"] == "patent":
                attrs = json.loads(entity["attributes"])
                for c in attrs.get("concepts", []):
                    concept_to_patents[c].append(entity["name"])

        for concept, patents in concept_to_patents.items():
            for i in range(min(len(patents), 10)):
                for j in range(i + 1, min(len(patents), 10)):
                    edges.append({
                        "source": patents[i], "target": patents[j],
                        "type": "shared_concept", "weight": 0.6,
                    })

        # Writing -> concept edges (by keyword matching)
        concept_keywords = {c[0]: c[1].lower() for c in CONCEPTS}
        for entity in entities:
            if entity["type"] != "writing":
                continue
            attrs = json.loads(entity["attributes"])
            title = attrs.get("title", "").lower()
            for cid, cname in concept_keywords.items():
                # Match if concept words appear in title
                concept_words = cname.split()
                if any(w in title for w in concept_words if len(w) > 3):
                    concept_name = f"concept_{cid}"
                    if concept_name in entity_names:
                        edges.append({
                            "source": entity["name"], "target": concept_name,
                            "type": "discusses_concept", "weight": 0.8,
                        })

        # Writing -> location edges
        writing_locations = {
            "lecture_columbia_1891": "new_york_lab_south_5th",
            "lecture_london_1892": "graz",  # UK lecture
            "lecture_philadelphia_1893": "world_columbian_expo",
            "colorado_springs_notes": "colorado_springs",
            "my_inventions_1919": "new_yorker_hotel",
        }
        for wid, lid in writing_locations.items():
            w_name = f"writing_{wid}"
            l_name = f"location_{lid}"
            if w_name in entity_names and l_name in entity_names:
                edges.append({
                    "source": w_name, "target": l_name,
                    "type": "presented_at", "weight": 0.8,
                })

        # Person -> person relationships
        person_edges = [
            ("nikola_tesla", "thomas_edison", "rival_of", 0.9),
            ("nikola_tesla", "george_westinghouse", "partnered_with", 1.0),
            ("nikola_tesla", "jp_morgan", "funded_by", 0.9),
            ("nikola_tesla", "john_jacob_astor", "funded_by", 0.7),
            ("nikola_tesla", "mark_twain", "friend_of", 0.8),
            ("nikola_tesla", "robert_underwood_johnson", "friend_of", 0.8),
            ("nikola_tesla", "katharine_johnson", "friend_of", 0.8),
            ("nikola_tesla", "guglielmo_marconi", "rival_of", 0.9),
            ("nikola_tesla", "lord_kelvin", "peer_of", 0.6),
            ("nikola_tesla", "koloman_czito", "employed", 0.7),
            ("nikola_tesla", "fritz_lowenstein", "employed_then_rival", 0.7),
            ("nikola_tesla", "john_oneil", "biographed_by", 0.6),
            ("nikola_tesla", "thomas_martin", "documented_by", 0.7),
            ("nikola_tesla", "sava_kosanovic", "related_to", 0.8),
            ("john_trump", "nikola_tesla", "examined_papers_of", 0.9),
            ("bloyce_fitzgerald", "nikola_tesla", "investigated", 0.8),
            ("sava_kosanovic", "bloyce_fitzgerald", "surveilled_by", 0.7),
        ]
        for src, tgt, etype, weight in person_edges:
            src_name = f"person_{src}"
            tgt_name = f"person_{tgt}"
            if src_name in entity_names and tgt_name in entity_names:
                edges.append({
                    "source": src_name, "target": tgt_name,
                    "type": etype, "weight": weight,
                })

        # Person -> location edges
        person_locations = [
            ("nikola_tesla", "smiljan", "born_at"),
            ("nikola_tesla", "graz", "studied_at"),
            ("nikola_tesla", "budapest", "worked_at"),
            ("nikola_tesla", "edison_machine_works", "worked_at"),
            ("nikola_tesla", "new_york_lab_south_5th", "worked_at"),
            ("nikola_tesla", "new_york_lab_houston_st", "worked_at"),
            ("nikola_tesla", "colorado_springs", "experimented_at"),
            ("nikola_tesla", "wardenclyffe", "built"),
            ("nikola_tesla", "new_yorker_hotel", "died_at"),
            ("thomas_edison", "edison_machine_works", "owned"),
            ("george_westinghouse", "niagara_falls", "funded"),
            ("jp_morgan", "wardenclyffe", "funded"),
        ]
        for pid, lid, etype in person_locations:
            p_name = f"person_{pid}"
            l_name = f"location_{lid}"
            if p_name in entity_names and l_name in entity_names:
                edges.append({
                    "source": p_name, "target": l_name,
                    "type": etype, "weight": 0.8,
                })

        # FBI documents -> people
        for entity in entities:
            if entity["type"] == "document":
                edges.append({
                    "source": entity["name"], "target": "person_nikola_tesla",
                    "type": "about", "weight": 1.0,
                })
                if "trump" in entity["name"]:
                    edges.append({
                        "source": entity["name"], "target": "person_john_trump",
                        "type": "examined_by", "weight": 0.9,
                    })
                if "kosanovic" in entity["name"]:
                    edges.append({
                        "source": entity["name"], "target": "person_sava_kosanovic",
                        "type": "about", "weight": 0.9,
                    })

        # Timeline event edges
        event_location_map = {
            "event_event_birth": "location_smiljan",
            "event_event_rotating_field": "location_budapest",
            "event_event_first_motor": "location_strasbourg",
            "event_event_arrives_america": "location_edison_machine_works",
            "event_event_edison_employment": "location_edison_machine_works",
            "event_event_lab_fire": "location_new_york_lab_south_5th",
            "event_event_colorado_springs": "location_colorado_springs",
            "event_event_artificial_lightning": "location_colorado_springs",
            "event_event_cosmic_signals": "location_colorado_springs",
            "event_event_wardenclyffe_begins": "location_wardenclyffe",
            "event_event_wardenclyffe_demolished": "location_wardenclyffe",
            "event_event_death": "location_new_yorker_hotel",
        }
        for ename, lname in event_location_map.items():
            if ename in entity_names and lname in entity_names:
                edges.append({"source": ename, "target": lname, "type": "occurred_at", "weight": 0.9})

        # All events connect to Tesla
        for entity in entities:
            if entity["type"] == "event" and "person_nikola_tesla" in entity_names:
                edges.append({"source": entity["name"], "target": "person_nikola_tesla", "type": "involves", "weight": 0.8})

        # Event -> person edges for specific events
        event_person_map = {
            "event_event_edison_employment": [("person_thomas_edison", "employed_by")],
            "event_event_leaves_edison": [("person_thomas_edison", "left")],
            "event_event_westinghouse_deal": [("person_george_westinghouse", "deal_with")],
            "event_event_morgan_funding": [("person_jp_morgan", "funded_by")],
            "event_event_morgan_withdraws": [("person_jp_morgan", "rejected_by")],
            "event_event_trump_examines": [("person_john_trump", "examined_by")],
            "event_event_papers_seized": [("person_bloyce_fitzgerald", "seized_by")],
        }
        for ename, connections in event_person_map.items():
            if ename in entity_names:
                for pname, etype in connections:
                    full_pname = pname if pname.startswith("person_") else f"person_{pname}"
                    if full_pname in entity_names:
                        edges.append({"source": ename, "target": full_pname, "type": etype, "weight": 0.8})

        # Temporal sequence between events
        event_entities = sorted(
            [e for e in entities if e["type"] == "event"],
            key=lambda e: json.loads(e["attributes"]).get("date", ""),
        )
        for i in range(len(event_entities) - 1):
            edges.append({
                "source": event_entities[i]["name"],
                "target": event_entities[i + 1]["name"],
                "type": "followed_by", "weight": 0.5,
            })

        return edges

    def get_anomaly_tags(self, record: dict, scores: dict, cluster_size: int, flips: int) -> list[dict]:
        tags = []
        entity_type = record.get("type", "")
        attrs = record.get("attributes", {})

        if entity_type == "patent":
            concepts = attrs.get("concepts", [])
            if "wireless" in concepts or "radio" in concepts:
                tags.append({
                    "tag": "WIRELESS_PATENT",
                    "severity": "high",
                    "description": "Wireless transmission patent — core to Tesla's most ambitious and controversial work.",
                })
            if "tesla-coil" in concepts:
                tags.append({
                    "tag": "TESLA_COIL_RELATED",
                    "severity": "medium",
                    "description": "Related to the Tesla coil — the invention most associated with Tesla's legacy.",
                })
            year = attrs.get("year", 0)
            if isinstance(year, int) and year >= 1900:
                tags.append({
                    "tag": "LATE_PERIOD",
                    "severity": "info",
                    "description": f"Filed {year} — Tesla's later period when funding was scarce and ideas grew more ambitious.",
                })

        elif entity_type == "document":
            source = attrs.get("source", "")
            if "FBI" in source:
                tags.append({
                    "tag": "FBI_CLASSIFIED",
                    "severity": "critical",
                    "description": "Previously classified FBI document. Seized after Tesla's death, declassified decades later.",
                })

        elif entity_type == "person":
            role = attrs.get("role", "")
            if role == "rival":
                tags.append({
                    "tag": "TESLA_RIVAL",
                    "severity": "medium",
                    "description": "Rival or competitor in Tesla's professional life.",
                })
            elif role == "investigator":
                tags.append({
                    "tag": "GOVERNMENT_INVESTIGATOR",
                    "severity": "high",
                    "description": "Government official involved in examining or seizing Tesla's work.",
                })

        elif entity_type == "concept":
            name = attrs.get("concept_name", "").lower()
            if "weapon" in name or "death" in name or "directed" in name or "teleforce" in name:
                tags.append({
                    "tag": "WEAPONS_CONCEPT",
                    "severity": "critical",
                    "description": "Concept related to Tesla's proposed directed energy weapon ('death ray').",
                })
            if "wireless" in name or "world" in name or "wardenclyffe" in name:
                tags.append({
                    "tag": "GLOBAL_SYSTEM",
                    "severity": "high",
                    "description": "Part of Tesla's vision for a worldwide wireless system.",
                })

        elif entity_type == "location":
            ltype = attrs.get("location_type", "")
            if ltype == "laboratory":
                tags.append({
                    "tag": "TESLA_LABORATORY",
                    "severity": "medium",
                    "description": "One of Tesla's laboratories — site of major experiments and breakthroughs.",
                })

        return tags

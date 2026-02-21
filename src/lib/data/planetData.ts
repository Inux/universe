/**
 * Extended planet information for the info panel
 */

export interface ExtendedPlanetInfo {
    mass: string;           // formatted mass string
    gravity: number;        // m/s² surface gravity
    temperature: number;    // K (average surface/cloud top)
    atmosphere: string;     // main composition
    description: string;    // interesting facts
    moonCount: number;      // total known moons
    type: string;           // planet classification
    discoverer?: string;    // who discovered it (for outer planets)
    yearDiscovered?: number;
}

export const PLANET_INFO: { [key: string]: ExtendedPlanetInfo } = {
    sun: {
        mass: "1.989 × 10³⁰ kg",
        gravity: 274,
        temperature: 5778,
        atmosphere: "Hydrogen (73%), Helium (25%)",
        description: "The Sun is a G-type main-sequence star at the center of our solar system. It contains 99.86% of the total mass of the solar system and generates energy through nuclear fusion of hydrogen into helium.",
        moonCount: 0,
        type: "G-type Star"
    },
    mercury: {
        mass: "3.301 × 10²³ kg",
        gravity: 3.7,
        temperature: 440,
        atmosphere: "Trace (O₂, Na, H₂)",
        description: "Mercury is the smallest and innermost planet. Despite being closest to the Sun, it's not the hottest due to its lack of atmosphere. It has the most eccentric orbit of all planets.",
        moonCount: 0,
        type: "Terrestrial"
    },
    venus: {
        mass: "4.867 × 10²⁴ kg",
        gravity: 8.87,
        temperature: 737,
        atmosphere: "CO₂ (96.5%), N₂ (3.5%)",
        description: "Venus is Earth's 'sister planet' due to similar size. It has the hottest surface of any planet due to extreme greenhouse effect. It rotates backwards compared to most planets.",
        moonCount: 0,
        type: "Terrestrial"
    },
    earth: {
        mass: "5.972 × 10²⁴ kg",
        gravity: 9.81,
        temperature: 288,
        atmosphere: "N₂ (78%), O₂ (21%)",
        description: "Earth is the only known planet with life. It has liquid water on its surface and a protective magnetic field. The Moon stabilizes Earth's axial tilt, enabling stable seasons.",
        moonCount: 1,
        type: "Terrestrial"
    },
    mars: {
        mass: "6.417 × 10²³ kg",
        gravity: 3.71,
        temperature: 210,
        atmosphere: "CO₂ (95%), N₂ (2.7%)",
        description: "Mars is called the 'Red Planet' due to iron oxide on its surface. It has the largest volcano (Olympus Mons) and canyon system (Valles Marineris) in the solar system.",
        moonCount: 2,
        type: "Terrestrial"
    },
    jupiter: {
        mass: "1.898 × 10²⁷ kg",
        gravity: 24.79,
        temperature: 165,
        atmosphere: "H₂ (90%), He (10%)",
        description: "Jupiter is the largest planet, with a mass 2.5× all other planets combined. The Great Red Spot is a storm larger than Earth that has raged for at least 400 years.",
        moonCount: 115,
        type: "Gas Giant"
    },
    saturn: {
        mass: "5.683 × 10²⁶ kg",
        gravity: 10.44,
        temperature: 134,
        atmosphere: "H₂ (96%), He (3%)",
        description: "Saturn has been known since antiquity. Galileo glimpsed its rings in 1610 but could not tell what they were. The rings are ice and rock, and Saturn is the least dense planet: it would float if there were an ocean big enough.",
        moonCount: 293,
        type: "Gas Giant"
    },
    uranus: {
        mass: "8.681 × 10²⁵ kg",
        gravity: 8.69,
        temperature: 76,
        atmosphere: "H₂ (83%), He (15%), CH₄ (2%)",
        description: "Uranus rotates on its side with an axial tilt of 98°, likely from a collision with an Earth-sized object. Its blue-green color comes from methane in the atmosphere.",
        moonCount: 29,
        type: "Ice Giant",
        discoverer: "William Herschel",
        yearDiscovered: 1781
    },
    neptune: {
        mass: "1.024 × 10²⁶ kg",
        gravity: 11.15,
        temperature: 72,
        atmosphere: "H₂ (80%), He (19%), CH₄ (1%)",
        description: "Neptune has the strongest winds in the solar system, reaching 2,100 km/h. It was the first planet found through mathematical prediction rather than observation.",
        moonCount: 16,
        type: "Ice Giant",
        discoverer: "Johann Galle",
        yearDiscovered: 1846
    },
    // Kuiper Belt Dwarf Planets
    pluto: {
        mass: "1.303 × 10²² kg",
        gravity: 0.62,
        temperature: 44,
        atmosphere: "N₂, CH₄, CO (thin)",
        description: "Pluto was reclassified as a dwarf planet in 2006. It has a heart-shaped nitrogen glacier called Tombaugh Regio and a complex relationship with its largest moon Charon.",
        moonCount: 5,
        type: "Dwarf Planet",
        discoverer: "Clyde Tombaugh",
        yearDiscovered: 1930
    },
    eris: {
        mass: "1.66 × 10²² kg",
        gravity: 0.82,
        temperature: 42,
        atmosphere: "Possible thin CH₄",
        description: "Eris is the most massive known dwarf planet. Its discovery in 2005 led to the reclassification of Pluto. It's named after the Greek goddess of strife and discord.",
        moonCount: 1,
        type: "Dwarf Planet",
        discoverer: "Mike Brown",
        yearDiscovered: 2005
    },
    makemake: {
        mass: "3.1 × 10²¹ kg",
        gravity: 0.5,
        temperature: 40,
        atmosphere: "None detected",
        description: "Makemake is one of the largest Kuiper belt objects. It's named after the creation deity of the Rapa Nui people of Easter Island. It has a reddish-brown color.",
        moonCount: 1,
        type: "Dwarf Planet",
        discoverer: "Mike Brown",
        yearDiscovered: 2005
    },
    haumea: {
        mass: "4.01 × 10²¹ kg",
        gravity: 0.44,
        temperature: 32,
        atmosphere: "None",
        description: "Haumea has an unusual elongated shape due to its rapid rotation (one day = 4 hours). It has a ring system and two small moons. Named after the Hawaiian goddess of fertility.",
        moonCount: 2,
        type: "Dwarf Planet",
        discoverer: "Mike Brown",
        yearDiscovered: 2004
    }
};

/**
 * Get emoji for planet type
 */
export function getPlanetEmoji(name: string): string {
    const emojis: { [key: string]: string } = {
        sun: '☀️',
        mercury: '☿️',
        venus: '♀️',
        earth: '🌍',
        mars: '🔴',
        jupiter: '🟠',
        saturn: '🪐',
        uranus: '🔵',
        neptune: '🔷',
        pluto: '🔘',
        eris: '⚪',
        makemake: '🟤',
        haumea: '🥚'
    };
    return emojis[name] || '🌑';
}

/**
 * Format temperature with both Kelvin and Celsius
 */
export function formatTemperature(kelvin: number): string {
    const celsius = Math.round(kelvin - 273.15);
    return `${kelvin} K (${celsius > 0 ? '+' : ''}${celsius}°C)`;
}

/**
 * Format large numbers with scientific notation
 */
export function formatDistance(km: number): string {
    if (km >= 1e9) {
        return `${(km / 1e9).toFixed(2)} billion km`;
    } else if (km >= 1e6) {
        return `${(km / 1e6).toFixed(1)} million km`;
    } else if (km >= 1000) {
        return `${(km / 1000).toFixed(0)} thousand km`;
    }
    return `${km.toLocaleString()} km`;
}

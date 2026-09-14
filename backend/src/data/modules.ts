/* Canonical catalog used by the API and the offline frontend. IDs identify individual POE experiments. */
export const modules = [
  {
    "id": "inertia",
    "groupId": "motion",
    "moduleNumber": 1,
    "moduleTitle": "Newton's Laws and Motion",
    "quarterNumber": 1,
    "icon": "motion",
    "title": "1.1 Inertia Challenge",
    "subtitle": "Observe an object at rest or in motion, then apply an unbalanced force.",
    "quarter": "Q1: Force, Motion, and Energy",
    "time": "15-20 min",
    "task": "Observe an object at rest or in motion, then apply an unbalanced force.",
    "predictions": [
      {
        "question": "At zero net force, a resting cart will?",
        "choices": [
          "Remain at rest",
          "Speed up",
          "Move backward"
        ]
      },
      {
        "question": "At zero net force, a moving cart will?",
        "choices": [
          "Keep a constant velocity",
          "Gradually stop",
          "Accelerate"
        ]
      },
      {
        "question": "An unbalanced force changes?",
        "choices": [
          "Velocity",
          "Mass",
          "The law of inertia"
        ]
      }
    ],
    "observe": "Compare zero force with a push. Try both a stationary and a moving cart.",
    "overview": "Without a net force, velocity remains constant. An unbalanced force changes velocity. The frictionless track wraps at its edge so motion stays visible."
  },
  {
    "id": "force-mass",
    "groupId": "motion",
    "moduleNumber": 1,
    "moduleTitle": "Newton's Laws and Motion",
    "quarterNumber": 1,
    "icon": "motion",
    "title": "1.2 Force, Mass, and Acceleration",
    "subtitle": "Change force and mass on a virtual cart and compare acceleration.",
    "quarter": "Q1: Force, Motion, and Energy",
    "time": "15-20 min",
    "task": "Change force and mass on a virtual cart and compare acceleration.",
    "predictions": [
      {
        "question": "Doubling force at fixed mass makes acceleration?",
        "choices": [
          "Double",
          "Halve",
          "Stay the same"
        ]
      },
      {
        "question": "Doubling mass at fixed force makes acceleration?",
        "choices": [
          "Halve",
          "Double",
          "Stay the same"
        ]
      },
      {
        "question": "Which accelerates fastest?",
        "choices": [
          "High force, low mass",
          "Low force, high mass",
          "Zero force"
        ]
      }
    ],
    "observe": "Hold mass constant while changing force; then hold force constant while changing mass.",
    "overview": "Newton's second law gives a = F/m. Doubling net force doubles acceleration; doubling mass halves acceleration at the same force."
  },
  {
    "id": "launcher",
    "groupId": "motion",
    "moduleNumber": 1,
    "moduleTitle": "Newton's Laws and Motion",
    "quarterNumber": 1,
    "icon": "motion",
    "title": "1.3 Action-Reaction Launcher",
    "subtitle": "Launch a balloon-powered cart and identify the force pair.",
    "quarter": "Q1: Force, Motion, and Energy",
    "time": "15-20 min",
    "task": "Launch a balloon-powered cart and identify the force pair.",
    "predictions": [
      {
        "question": "The reaction to air pushed backward is?",
        "choices": [
          "The cart pushed forward",
          "The cart pushed backward",
          "No force"
        ]
      },
      {
        "question": "Action and reaction act on?",
        "choices": [
          "Different objects",
          "The same object",
          "Neither object"
        ]
      },
      {
        "question": "A heavier cart at equal thrust has?",
        "choices": [
          "Less acceleration",
          "More acceleration",
          "No mass"
        ]
      }
    ],
    "observe": "Change thrust and cart mass. Compare the arrows on the expelled air and the cart.",
    "overview": "The cart pushes air backward and the air pushes the cart forward with equal forces. These forces act on different objects, so they do not cancel on the cart."
  },
  {
    "id": "series",
    "groupId": "electricity",
    "moduleNumber": 2,
    "moduleTitle": "Electric Current and Circuits",
    "quarterNumber": 1,
    "icon": "electricity",
    "title": "1.4 Series Circuit Investigation",
    "subtitle": "Change batteries and bulbs to observe current and brightness.",
    "quarter": "Q1: Force, Motion, and Energy",
    "time": "15-20 min",
    "task": "Change batteries and bulbs to observe current and brightness.",
    "predictions": [
      {
        "question": "Adding series bulbs at fixed voltage makes each bulb?",
        "choices": [
          "Dimmer",
          "Brighter",
          "Unchanged"
        ]
      },
      {
        "question": "Adding batteries increases?",
        "choices": [
          "Current",
          "Resistance of each bulb",
          "Number of paths"
        ]
      },
      {
        "question": "Opening the switch makes?",
        "choices": [
          "All bulbs go out",
          "One bulb brighten",
          "Current increase"
        ]
      }
    ],
    "observe": "Compare one to three batteries and bulbs, then open the switch.",
    "overview": "Identical bulbs in series share one current path. More bulbs increase total resistance. More batteries increase voltage. Opening the circuit stops current everywhere."
  },
  {
    "id": "parallel",
    "groupId": "electricity",
    "moduleNumber": 2,
    "moduleTitle": "Electric Current and Circuits",
    "quarterNumber": 1,
    "icon": "electricity",
    "title": "1.5 Parallel Circuit Investigation",
    "subtitle": "Remove a bulb and observe why other bulbs remain lit.",
    "quarter": "Q1: Force, Motion, and Energy",
    "time": "15-20 min",
    "task": "Remove a bulb and observe why other bulbs remain lit.",
    "predictions": [
      {
        "question": "Removing one parallel bulb leaves others?",
        "choices": [
          "Lit",
          "All off",
          "Short circuited"
        ]
      },
      {
        "question": "Each branch receives?",
        "choices": [
          "The supply voltage",
          "Zero voltage",
          "A share divided by bulb count"
        ]
      },
      {
        "question": "Adding a parallel branch increases?",
        "choices": [
          "Total current",
          "Resistance of every bulb",
          "Voltage of the battery"
        ]
      }
    ],
    "observe": "Toggle individual bulb branches and compare remaining bulb brightness and total current.",
    "overview": "Parallel branches each receive the supply voltage. Removing one branch stops its current while other closed branches stay lit. Total current is the sum of branch currents."
  },
  {
    "id": "home-circuit",
    "groupId": "electricity",
    "moduleNumber": 2,
    "moduleTitle": "Electric Current and Circuits",
    "quarterNumber": 1,
    "icon": "electricity",
    "title": "1.6 Home Circuit Designer",
    "subtitle": "Build a low-voltage model and compare series and parallel wiring.",
    "quarter": "Q1: Force, Motion, and Energy",
    "time": "15-20 min",
    "task": "Build a low-voltage model and compare series and parallel wiring.",
    "predictions": [
      {
        "question": "Independent home lights use?",
        "choices": [
          "Parallel wiring",
          "Only series wiring",
          "No return path"
        ]
      },
      {
        "question": "A fuse protects by?",
        "choices": [
          "Opening on excessive current",
          "Increasing current",
          "Removing resistance"
        ]
      },
      {
        "question": "A complete working circuit needs?",
        "choices": [
          "A closed path through a load",
          "Only a battery",
          "An open switch"
        ]
      }
    ],
    "observe": "Select wiring, install bulbs, and close the switch. Compare what happens when a bulb is removed.",
    "overview": "This is a low-voltage virtual model with a protective fuse. Parallel wiring allows independent lights. A fuse opens when total current exceeds its rating. Household mains are not used in this activity."
  },
  {
    "id": "seismic",
    "groupId": "earth-space",
    "moduleNumber": 1,
    "moduleTitle": "Earth's Interior",
    "quarterNumber": 2,
    "icon": "earth",
    "title": "2.1 Seismic-Wave Investigation",
    "subtitle": "Compare P-waves and S-waves in solid and liquid layers.",
    "quarter": "Q2: Earth and Space Science",
    "time": "15-20 min",
    "task": "Compare P-waves and S-waves in solid and liquid layers.",
    "predictions": [
      {
        "question": "Which travels through a liquid?",
        "choices": [
          "P-wave",
          "S-wave",
          "Neither"
        ]
      },
      {
        "question": "S-wave motion is?",
        "choices": [
          "Transverse to travel",
          "Always in the travel direction",
          "Motionless in solids"
        ]
      },
      {
        "question": "An outer core that blocks S-waves is inferred to be?",
        "choices": [
          "Liquid",
          "Empty",
          "Solid crust"
        ]
      }
    ],
    "observe": "Switch wave type and material. Observe particle motion and whether the wave crosses the sample.",
    "overview": "P-waves compress material and travel through solids and liquids. S-waves shear solids and cannot propagate through liquids. This evidence supports a liquid outer core. This sample model is not a map of global ray paths."
  },
  {
    "id": "earth-scale",
    "groupId": "earth-space",
    "moduleNumber": 1,
    "moduleTitle": "Earth's Interior",
    "quarterNumber": 2,
    "icon": "earth",
    "title": "2.2 Build Earth's Interior to Scale",
    "subtitle": "Assemble and label Earth's interior using relative depths and thicknesses.",
    "quarter": "Q2: Earth and Space Science",
    "time": "15-20 min",
    "task": "Assemble and label Earth's interior using relative depths and thicknesses.",
    "predictions": [
      {
        "question": "From the center outward, first comes?",
        "choices": [
          "Inner core",
          "Crust",
          "Lithosphere"
        ]
      },
      {
        "question": "The lithosphere includes?",
        "choices": [
          "Crust and uppermost mantle",
          "Only the outer core",
          "All of the mantle"
        ]
      },
      {
        "question": "The thickest compositional layer is?",
        "choices": [
          "Mantle",
          "Crust",
          "Inner core"
        ]
      }
    ],
    "observe": "Add the compositional layers from inside outward, then identify the overlapping lithosphere and asthenosphere.",
    "overview": "The model uses a 6,371 km radius: inner core to 1,221 km radius, outer core to 3,480 km, mantle to a representative 35 km crust. Lithosphere (0-100 km depth) includes crust and uppermost mantle; asthenosphere (100-350 km here) lies within the mantle. These shallow boundaries vary by location and are overlays, not extra concentric compositional layers."
  },
  {
    "id": "replication",
    "groupId": "life",
    "moduleNumber": 1,
    "moduleTitle": "DNA and Mutation",
    "quarterNumber": 3,
    "icon": "life",
    "title": "3.1 DNA Replication Model",
    "subtitle": "Match complementary nucleotide bases to copy genetic information.",
    "quarter": "Q3: Life Science",
    "time": "15-20 min",
    "task": "Match complementary nucleotide bases to copy genetic information.",
    "predictions": [
      {
        "question": "A pairs with?",
        "choices": [
          "T",
          "C",
          "G"
        ]
      },
      {
        "question": "C pairs with?",
        "choices": [
          "G",
          "A",
          "T"
        ]
      },
      {
        "question": "Each daughter DNA molecule contains?",
        "choices": [
          "One old and one new strand",
          "Only old strands",
          "Only new strands"
        ]
      }
    ],
    "observe": "Separate the template strands, then match each exposed base. Complete both daughter DNA molecules.",
    "overview": "A pairs with T and C pairs with G. Each daughter DNA molecule contains one original strand and one newly synthesized complementary strand: semiconservative replication."
  },
  {
    "id": "mutation",
    "groupId": "life",
    "moduleNumber": 1,
    "moduleTitle": "DNA and Mutation",
    "quarterNumber": 3,
    "icon": "life",
    "title": "3.2 Mutation Effects Simulator",
    "subtitle": "Introduce a substitution, insertion, or deletion into a DNA sequence.",
    "quarter": "Q3: Life Science",
    "time": "15-20 min",
    "task": "Introduce a substitution, insertion, or deletion into a DNA sequence.",
    "predictions": [
      {
        "question": "A substitution can?",
        "choices": [
          "Change one base",
          "Always remove three bases",
          "Always improve a trait"
        ]
      },
      {
        "question": "A one-base insertion in a coding sequence causes?",
        "choices": [
          "A frameshift",
          "No possible change",
          "Only an extra whole codon"
        ]
      },
      {
        "question": "A DNA mutation always causes disease.",
        "choices": [
          "False",
          "True",
          "Only in this model"
        ]
      }
    ],
    "observe": "Choose a mutation and position. Compare DNA codons and the translated protein with the original.",
    "overview": "A substitution may leave a protein unchanged, change one amino acid, or introduce a stop. A one-base insertion or deletion shifts the reading frame in this coding sequence. A protein change does not by itself determine a trait or whether the effect is harmful."
  },
  {
    "id": "chemical-change",
    "groupId": "materials",
    "moduleNumber": 1,
    "moduleTitle": "Chemical Bonding and Chemical Change",
    "quarterNumber": 4,
    "icon": "materials",
    "title": "4.1 Simple Chemical Change Investigation",
    "subtitle": "Combine virtual vinegar and baking soda and observe gas formation.",
    "quarter": "Q4: Science of Materials",
    "time": "15-20 min",
    "task": "Combine virtual vinegar and baking soda and observe gas formation.",
    "predictions": [
      {
        "question": "Mixing the ingredients produces?",
        "choices": [
          "Carbon dioxide gas",
          "Only a temperature change",
          "No new substances"
        ]
      },
      {
        "question": "Evidence of this reaction includes?",
        "choices": [
          "Bubbling gas",
          "Only stirring",
          "The container shape"
        ]
      },
      {
        "question": "With only one ingredient there is?",
        "choices": [
          "No acid-bicarbonate reaction",
          "The same bubbling",
          "More carbon dioxide"
        ]
      }
    ],
    "observe": "Add each ingredient. Compare one ingredient alone with both together.",
    "overview": "Vinegar reacts with baking soda to form carbon dioxide gas, water, and sodium acetate. Bubbling in this reaction is evidence of a new substance. The displayed reaction amount is qualitative."
  },
  {
    "id": "bonding",
    "groupId": "materials",
    "moduleNumber": 1,
    "moduleTitle": "Chemical Bonding and Chemical Change",
    "quarterNumber": 4,
    "icon": "materials",
    "title": "4.2 Basic Bonding Model",
    "subtitle": "Transfer or share electrons to model sodium chloride and water.",
    "quarter": "Q4: Science of Materials",
    "time": "15-20 min",
    "task": "Transfer or share electrons to model sodium chloride and water.",
    "predictions": [
      {
        "question": "In NaCl an electron is?",
        "choices": [
          "Transferred from Na to Cl",
          "Destroyed",
          "Shared equally"
        ]
      },
      {
        "question": "Water contains?",
        "choices": [
          "Shared electron pairs",
          "Only ionic bonds",
          "No electrons"
        ]
      },
      {
        "question": "After losing an electron sodium becomes?",
        "choices": [
          "Positive",
          "Negative",
          "Uncharged"
        ]
      }
    ],
    "observe": "Drag an electron to chlorine for NaCl. For water, place shared pairs in both O-H bonds.",
    "overview": "Sodium transfers one valence electron to chlorine, forming Na+ and Cl- ions. In water, oxygen shares one electron pair with each hydrogen. Oxygen also has two lone pairs."
  }
];

export function toPersistedModule(module: { id: string; icon: string; title: string; subtitle: string; quarter: string; time: string; task: string; predictions: { question: string; choices: string[] }[]; observe: string }) {
  // Whitelist database fields; curriculum grouping is served from the catalog.
  return { id: module.id, icon: module.icon, title: module.title, subtitle: module.subtitle,
    quarter: module.quarter, time: module.time, task: module.task, observe: module.observe,
    prediction: module.predictions[0].question, choices: module.predictions[0].choices };
}

/* Post-activity lessons, shown after Explain. Competency text is quoted from the DepEd MATATAG
   Science Curriculum Guide, Grades 3-10 (August 2023), Grade 9. Lines starting "- " render as a list. */
export interface Lesson {
  competencies: { code: string; text: string }[];
  sections: { title: string; text: string[] }[];
}

export const lessons: Record<string, Lesson> = {
  "inertia": {
    "competencies": [
      {
        "code": "Q1 no. 1",
        "text": "identify inertia as the tendency for an object to stay at rest or in motion unless acted on by an unbalanced net force"
      }
    ],
    "sections": [
      {
        "title": "Key idea",
        "text": [
          "Inertia is the tendency for an object to stay at rest or in motion unless acted on by an unbalanced net force. A resting object stays at rest. A moving object keeps moving at the same speed in a straight line. An object with more mass has more inertia. When a net force does act, the object accelerates: its speed changes, its direction changes, or both."
        ]
      },
      {
        "title": "What you saw",
        "text": [
          "At zero force the resting cart did not move, and the moving cart kept rolling at a constant speed around the track. It only sped up, slowed down, or turned around when you applied a push."
        ]
      },
      {
        "title": "Common mistake",
        "text": [
          "\"Moving things stop on their own.\" Real objects stop because of friction and air resistance, and those are forces. The track in the simulation has no friction, so nothing slowed the cart."
        ]
      },
      {
        "title": "In real life",
        "text": [
          "When a jeepney brakes suddenly, passengers lurch forward. Their bodies keep moving even though the jeepney has stopped. A seatbelt supplies the force that stops your body together with the vehicle."
        ]
      }
    ]
  },
  "force-mass": {
    "competencies": [
      {
        "code": "Q1 no. 3",
        "text": "investigate the relationship among force, acceleration, and mass"
      },
      {
        "code": "Q1 no. 2",
        "text": "demonstrate in practical situations and describe that acceleration is a change in speed and/or direction as the result of a net force"
      }
    ],
    "sections": [
      {
        "title": "Key idea",
        "text": [
          "Acceleration is a change in speed and/or direction caused by a net force. How much an object accelerates depends on two things: the net force and the mass. a = F / m, with force in newtons (N), mass in kilograms (kg), and acceleration in meters per second squared (m/s²)."
        ]
      },
      {
        "title": "What you saw",
        "text": [
          "Doubling the force at the same mass doubled the acceleration. Doubling the mass at the same force halved the acceleration. The largest acceleration came from a large force on a small mass."
        ]
      },
      {
        "title": "Worked example",
        "text": [
          "A 10 N push on a 2 kg cart: a = 10 ÷ 2 = 5 m/s². Double the push to 20 N: a = 10 m/s². Keep 10 N but use a 4 kg cart: a = 2.5 m/s²."
        ]
      },
      {
        "title": "Common mistake",
        "text": [
          "\"A bigger force means a bigger speed.\" Force changes how fast the speed changes. A cart with zero net force can still be moving, as you saw in 1.1."
        ]
      },
      {
        "title": "In real life",
        "text": [
          "An empty kariton at the palengke is easy to get moving. Loaded with sacks of rice and pushed just as hard, it speeds up much more slowly."
        ]
      }
    ]
  },
  "launcher": {
    "competencies": [
      {
        "code": "Q1 no. 4",
        "text": "explain that when any two objects interact, there are equal but opposite forces exerted between them, which is evident in many practical situations and applications"
      },
      {
        "code": "Q1 no. 5",
        "text": "observe and identify action-reaction pairs in everyday situations such as stepping off a boat, or a book on a table, and draw force diagrams to explain how the pairs affect the motion of objects"
      }
    ],
    "sections": [
      {
        "title": "Key idea",
        "text": [
          "When two objects interact, they push or pull on each other with forces that are equal in size and opposite in direction. These are called action-reaction pairs."
        ]
      },
      {
        "title": "What you saw",
        "text": [
          "The balloon pushed air backward (action) and the air pushed the cart forward (reaction). The two arrows were the same length and pointed opposite ways. A heavier cart with the same thrust sped up less (the second law). Once the balloon was empty, the cart coasted at the speed it had reached (the first law)."
        ]
      },
      {
        "title": "Force diagram",
        "text": [
          "Draw one arrow on each object: on the air, an arrow pointing backward; on the cart, an arrow of the same length pointing forward."
        ]
      },
      {
        "title": "Common mistake",
        "text": [
          "\"If the forces are equal and opposite, they cancel and nothing moves.\" They do not cancel, because they act on different objects: one on the air, one on the cart. Only the forward push acts on the cart, so the cart accelerates."
        ]
      },
      {
        "title": "In real life",
        "text": [
          "When you step off a bangka onto the pier, your foot pushes the bangka backward and the bangka pushes you forward, which is why a small boat drifts away as you step off. A book on a table pushes down on the table, and the table pushes up on the book with an equal force."
        ]
      }
    ]
  },
  "series": {
    "competencies": [
      {
        "code": "Q1 no. 7",
        "text": "participate in guided investigations to infer the relationship among current, voltage, and resistance in assembled series and parallel circuits with varying number of loads and battery"
      },
      {
        "code": "Q1 no. 6",
        "text": "identify that electricity is a flow of electrons and show appreciation for the need to observe safe measures in handling electricity"
      }
    ],
    "sections": [
      {
        "title": "Key idea",
        "text": [
          "Electric current is a flow of electrons through a closed path. In a series circuit there is only one path, so the same current passes through every bulb. Voltage (from the cells) pushes the current; resistance (from the bulbs) opposes it. More voltage gives more current. More resistance gives less current."
        ]
      },
      {
        "title": "What you saw",
        "text": [
          "Adding a bulb added resistance, so the current dropped and every bulb got dimmer. Adding a cell added voltage, so the current rose and the bulbs got brighter. Opening the switch, or removing one bulb, broke the only path, so all the bulbs went out."
        ]
      },
      {
        "title": "Common mistake",
        "text": [
          "\"The first bulb uses up the current, so the last bulb is dimmest.\" Current is not used up. Identical bulbs in series carry the same current and glow equally. What the bulbs share is the voltage."
        ]
      },
      {
        "title": "In real life",
        "text": [
          "In some older strings of Christmas lights, one loose or broken bulb makes the whole string go dark. That is a series circuit: one break stops the current everywhere."
        ]
      },
      {
        "title": "Safety",
        "text": [
          "These are low-voltage cells. Never experiment with an outlet or house wiring."
        ]
      }
    ]
  },
  "parallel": {
    "competencies": [
      {
        "code": "Q1 no. 7",
        "text": "participate in guided investigations to infer the relationship among current, voltage, and resistance in assembled series and parallel circuits with varying number of loads and battery"
      },
      {
        "code": "Q1 no. 8",
        "text": "draw diagrams of and assemble series and parallel circuits, showing switch, battery, loads/resistors, ammeter, and voltmeter"
      }
    ],
    "sections": [
      {
        "title": "Key idea",
        "text": [
          "In a parallel circuit each bulb sits on its own branch, connected directly across the battery. Every branch gets the full battery voltage, and each branch has its own path for current. The total current from the battery is the sum of the branch currents."
        ]
      },
      {
        "title": "What you saw",
        "text": [
          "Removing one bulb stopped the current in that branch only; the other bulbs stayed lit and kept their brightness. Adding a branch did not dim the others, but it increased the total current drawn from the battery."
        ]
      },
      {
        "title": "Drawing it",
        "text": [
          "In a circuit diagram, parallel bulbs are drawn as rungs of a ladder between the same two wires. An ammeter goes in series with the part whose current you measure; a voltmeter goes across (in parallel with) the part whose voltage you measure."
        ]
      },
      {
        "title": "Common mistake",
        "text": [
          "\"More bulbs in parallel make every bulb dimmer.\" Each branch still gets the full voltage, so each bulb stays just as bright. The cost is that the battery must supply more total current, so it runs down faster."
        ]
      },
      {
        "title": "In real life",
        "text": [
          "The lights and outlets in a house are wired in parallel. That is why switching off the electric fan does not turn off the TV."
        ]
      }
    ]
  },
  "home-circuit": {
    "competencies": [
      {
        "code": "Q1 no. 9",
        "text": "collaborate in a class discussion to recognize the advantages and limitations of using series or parallel circuits"
      },
      {
        "code": "Q1 no. 6",
        "text": "identify that electricity is a flow of electrons and show appreciation for the need to observe safe measures in handling electricity"
      }
    ],
    "sections": [
      {
        "title": "Key idea",
        "text": [
          "Homes use parallel wiring so each appliance gets the full supply voltage and can be switched on or off by itself. A fuse or circuit breaker protects the wiring by opening the circuit when the total current gets too high."
        ]
      },
      {
        "title": "Series vs parallel",
        "text": [
          "- Series: simple, and one switch controls everything. But one break turns everything off, and adding loads makes them dimmer.",
          "- Parallel: each load works on its own at full voltage. But every added load increases the total current, so too many loads on one line can overheat the wires."
        ]
      },
      {
        "title": "What you saw",
        "text": [
          "With parallel wiring, removing a bulb left the others lit. Adding loads raised the total current, and when it went past the fuse's rating, the fuse opened and stopped the current."
        ]
      },
      {
        "title": "Common mistake",
        "text": [
          "\"A fuse is just an on/off switch.\" A fuse is a safety device. It opens on its own when the current is too high, before the wires get hot enough to start a fire."
        ]
      },
      {
        "title": "In real life",
        "text": [
          "Plugging many appliances into one outlet with extension cords (an \"octopus connection\") makes one line carry too much current. This is a common cause of house fires. Homes in the Philippines use 220 V, which is dangerous; this activity uses only a low-voltage model."
        ]
      }
    ]
  },
  "seismic": {
    "competencies": [
      {
        "code": "Q2 no. 7",
        "text": "describe how seismic wave data has been used to develop a model for the internal structure and composition of the Earth"
      }
    ],
    "sections": [
      {
        "title": "Key idea",
        "text": [
          "Earthquakes send out two kinds of body waves. P-waves (primary) push and pull the material along the direction the wave travels. They are the fastest and travel through solids, liquids, and gases. S-waves (secondary) shake the material sideways, across the direction of travel. They are slower and travel only through solids, because a liquid cannot be sheared."
        ]
      },
      {
        "title": "What you saw",
        "text": [
          "The P-wave crossed both the solid and the liquid samples. The S-wave crossed the solid but stopped at the liquid."
        ]
      },
      {
        "title": "How this reveals Earth's interior",
        "text": [
          "Seismographs on the side of Earth far from an earthquake (more than about 104° away) do not record S-waves. Something deep inside blocks them. Since S-waves cannot pass through liquids, scientists concluded that Earth's outer core is liquid."
        ]
      },
      {
        "title": "Common mistake",
        "text": [
          "\"The S-waves just ran out of energy before reaching the far side.\" P-waves from the same earthquake do arrive there. The S-waves are missing because of what they pass through, not how far they travel."
        ]
      },
      {
        "title": "In real life",
        "text": [
          "PHIVOLCS uses seismographs across the country. In an earthquake, people often feel a sharp jolt first (the P-wave) and then stronger shaking (the S-wave). The time between the two helps find how far away the earthquake was."
        ]
      }
    ]
  },
  "earth-scale": {
    "competencies": [
      {
        "code": "Q2 no. 8",
        "text": "create a scale drawing to represent relative thicknesses of the layers of Earth's interior, including the crust, lithosphere, asthenosphere, mantle, outer core, and inner core"
      }
    ],
    "sections": [
      {
        "title": "Key idea",
        "text": [
          "Earth (radius 6,371 km) has layers of very different thickness:",
          "- Crust: the thin outer layer, about 5-70 km thick (thin under oceans, thicker under continents).",
          "- Mantle: the thickest layer, reaching down to 2,891 km.",
          "- Outer core: liquid metal, from 2,891 km to about 5,150 km deep.",
          "- Inner core: solid metal, from about 5,150 km deep to the center.",
          "The lithosphere (crust plus the top of the mantle, about 0-100 km) is rigid and broken into plates. The asthenosphere below it is soft enough to flow slowly, so the plates can move on it. These two are not extra layers: they describe how stiff the rock is, and they overlap the crust and mantle."
        ]
      },
      {
        "title": "What you saw",
        "text": [
          "In the model the crust is a thin skin. When you zoomed in to the surface, the lithosphere and asthenosphere appeared as bands within the outer part of the Earth."
        ]
      },
      {
        "title": "Scale example",
        "text": [
          "If Earth were a ball 1 meter across, the crust would be about 3 mm thick, the mantle about 22 cm, the outer core about 18 cm, and the inner core about 10 cm from the center."
        ]
      },
      {
        "title": "Common mistake",
        "text": [
          "\"The lithosphere is just another name for the crust.\" The lithosphere also includes the uppermost mantle."
        ]
      },
      {
        "title": "In real life",
        "text": [
          "The Philippines sits where lithospheric plates meet, including the Philippine Sea Plate. Their movement causes our frequent earthquakes and volcanoes."
        ]
      }
    ]
  },
  "replication": {
    "competencies": [
      {
        "code": "Q3 no. 1",
        "text": "use models and labeled diagrams to represent the double helix structure of DNA (deoxyribonucleic acid)"
      },
      {
        "code": "Q3 no. 2",
        "text": "explain the role of DNA, genes, and chromosomes in the transmission of traits"
      }
    ],
    "sections": [
      {
        "title": "Key idea",
        "text": [
          "DNA is a double helix: two strands twisted around each other, joined by pairs of bases. There are four bases, and they always pair the same way: A with T and C with G. A gene is a section of DNA that carries the instructions for a trait. Chromosomes are long DNA molecules tightly coiled with proteins."
        ]
      },
      {
        "title": "What you saw",
        "text": [
          "The helix unzipped, and each old strand (blue) served as a template. New bases (orange) were matched to it, A to T and C to G. Each of the two new DNA molecules kept one old strand and got one new strand. This is called semiconservative replication."
        ]
      },
      {
        "title": "Why it matters",
        "text": [
          "Before a cell divides, it copies its DNA so each new cell gets a complete, matching set of instructions. That is how traits are passed on as you grow and as parents pass DNA to their children."
        ]
      },
      {
        "title": "Common mistake",
        "text": [
          "\"Replication makes one all-old molecule and one all-new molecule.\" Each copy is half old and half new."
        ]
      },
      {
        "title": "In real life",
        "text": [
          "When a wound on your skin heals, new skin cells are made by cell division, and each one carries an exact copy of your DNA."
        ]
      }
    ]
  },
  "mutation": {
    "competencies": [
      {
        "code": "Q3 no. 3",
        "text": "describe mutations as changes in DNA or chromosomes and discuss some of the factors that cause mutations, such as infectious agents, radiation, and chemicals"
      },
      {
        "code": "Q3 no. 4",
        "text": "use information from secondary sources to explain the beneficial, harmful, and neutral effects of mutations"
      }
    ],
    "sections": [
      {
        "title": "Key idea",
        "text": [
          "A mutation is a change in DNA. The cell reads DNA three bases at a time; each group of three (a codon) stands for one amino acid in a protein.",
          "- Substitution: one base is swapped for another. The protein may stay the same, have one different amino acid, or stop early.",
          "- Insertion or deletion: a base is added or removed, so every codon after it shifts (a frameshift). This usually changes the rest of the protein."
        ]
      },
      {
        "title": "What you saw",
        "text": [
          "The orange beads marked amino acids that changed, and red marked an early STOP. A substitution changed one codon at most. An insertion or deletion regrouped every base after that point."
        ]
      },
      {
        "title": "Effects",
        "text": [
          "Mutations can be neutral (no change to the protein), harmful (for example, sickle cell anemia comes from one substitution in the gene for hemoglobin), or beneficial (people who carry one copy of that same sickle cell gene are more resistant to malaria)."
        ]
      },
      {
        "title": "Causes",
        "text": [
          "Mutations can be caused by radiation (such as ultraviolet light from the sun and X-rays), chemicals (such as those in cigarette smoke), and some infectious agents (such as certain viruses). Many also happen by chance when DNA is copied."
        ]
      },
      {
        "title": "Common mistake",
        "text": [
          "\"Every mutation causes disease.\" Many mutations have no effect, and some are helpful."
        ]
      },
      {
        "title": "In real life",
        "text": [
          "Using sunscreen and avoiding cigarette smoke lower your exposure to things that can damage DNA."
        ]
      }
    ]
  },
  "chemical-change": {
    "competencies": [
      {
        "code": "Q4 no. 1",
        "text": "carry out a valid and reliable scientific investigation to show the formation of a new substance, such as formation of a carbonate (carbon dioxide in limewater), or formation of a precipitate (from silver nitrate solution)"
      },
      {
        "code": "Q4 no. 2",
        "text": "explain that the formation of new bonds or the breaking of existing bonds constitutes a chemical change and the formation of a new substance"
      }
    ],
    "sections": [
      {
        "title": "Key idea",
        "text": [
          "In a chemical change, bonds in the starting substances break and new bonds form, making new substances. Vinegar (acetic acid) and baking soda (sodium bicarbonate) react to form sodium acetate, water, and carbon dioxide gas:",
          "acetic acid + sodium bicarbonate → sodium acetate + water + carbon dioxide"
        ]
      },
      {
        "title": "What you saw",
        "text": [
          "With only one ingredient nothing happened. With both, the mixture bubbled. The bubbles are carbon dioxide, a new substance."
        ]
      },
      {
        "title": "A fair test",
        "text": [
          "The one-ingredient trial is your control: it shows the bubbles come from the reaction, not from either ingredient alone. A valid investigation changes one variable at a time and keeps the others the same."
        ]
      },
      {
        "title": "Testing the gas",
        "text": [
          "Bubbling carbon dioxide through limewater turns it milky. This is the standard test that shows the gas really is carbon dioxide."
        ]
      },
      {
        "title": "Common mistake",
        "text": [
          "\"Bubbles mean it is boiling.\" The mixture is not heated. These bubbles are a new gas being made, which is evidence of a chemical change."
        ]
      },
      {
        "title": "In real life",
        "text": [
          "Baking soda in pancake or puto batter reacts with an acid to release carbon dioxide, and the gas bubbles make the batter rise."
        ]
      }
    ]
  },
  "bonding": {
    "competencies": [
      {
        "code": "Q4 no. 5",
        "text": "explain the formation of ions as either the loss or gain of electrons to produce ionic bonds, using examples, such as the formation of sodium chloride"
      },
      {
        "code": "Q4 no. 7",
        "text": "explain the formation of covalent bonds using a molecule of water and a molecule of carbon dioxide"
      },
      {
        "code": "Q4 no. 3",
        "text": "describe a valence electron as an electron in the outer shell of an atom that can take part in formation of bonds"
      }
    ],
    "sections": [
      {
        "title": "Key idea",
        "text": [
          "Valence electrons are the electrons in an atom's outer shell. They are the ones that take part in bonding.",
          "- Ionic bond (transfer): sodium has 1 valence electron and chlorine has 7. Sodium gives its electron to chlorine. Sodium becomes a positive ion (Na⁺) and chlorine a negative ion (Cl⁻), and the opposite charges attract. Ionic compounds like NaCl form crystals.",
          "- Covalent bond (sharing): oxygen has 6 valence electrons and needs 2 more. In water (H₂O) it shares one pair of electrons with each hydrogen atom. Oxygen also keeps two lone pairs. Covalent compounds like water form separate molecules."
        ]
      },
      {
        "title": "What you saw",
        "text": [
          "Dragging the electron from sodium to chlorine made two ions with opposite charges. In water, you placed one shared pair in each O-H bond."
        ]
      },
      {
        "title": "Common mistake",
        "text": [
          "\"Sodium and chlorine share an electron.\" In sodium chloride the electron is transferred, not shared. Sharing is what happens in covalent bonds like those in water."
        ]
      },
      {
        "title": "In real life",
        "text": [
          "Table salt (asin) is sodium chloride; its grains are tiny cube-shaped crystals. Water is a covalent compound made of separate H₂O molecules."
        ]
      }
    ]
  }
};

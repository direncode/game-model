export function ArchitectureSection() {
  return (
    <section id="architecture" className="py-32 border-t border-[#2F343C]/40">
      <div className="max-w-[1200px] mx-auto px-8">
        <p className="text-[13px] text-[#5F6B7C] tracking-[0.15em] uppercase mb-6">
          Architecture
        </p>

        <h2
          className="text-[#F6F7F9] font-semibold leading-[1.08] tracking-tight max-w-[700px]"
          style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)', letterSpacing: '-0.025em' }}
        >
          How it connects
        </h2>

        <p className="text-[#8F99A8] text-base leading-relaxed max-w-[600px] mt-6 mb-20">
          A directed pipeline where each module consumes the output of its predecessors.
          Data flows from ingestors through analysis engines to actionable recommendations.
        </p>

        {/* Architecture diagram as text */}
        <div className="grid md:grid-cols-2 gap-px bg-[#2F343C]/40">
          {[
            {
              title: 'Data Ingestors',
              connections: 'Outputs to Pattern Recognition Engine and Fatigue Model',
              detail: 'Four modules — Football Data API, Premier League API, Catapult GPS/IMU, and Wearable Analytics — normalize heterogeneous data sources into a unified schema. GPS positional data feeds Pattern Recognition. Physical metrics feed the Fatigue Model.',
            },
            {
              title: 'Pattern Recognition',
              connections: 'Outputs to Markov Chain and Coherence Analysis',
              detail: 'Processes positional data into detected tactical patterns. Feeds pattern sequences to the Markov Chain for probability modeling. Sends pattern-match data to Coherence Analysis for game model adherence scoring.',
            },
            {
              title: 'Markov Chain Analysis',
              connections: 'Outputs to Coherence Analysis',
              detail: 'Builds state transition matrices from detected patterns. Computes chain health scores and recurrent sequences. Provides next-pattern prediction probabilities to the Coherence Analysis module.',
            },
            {
              title: 'Fatigue Model',
              connections: 'Outputs to Digital Twin and Recommendations',
              detail: 'Processes GPS and wearable metrics into fatigue state vectors. Tracks muscular fatigue, cardiovascular load, sprint capacity remaining, and injury risk. Feeds physical alerts directly to Recommendations and fatigue state to Digital Twin.',
            },
            {
              title: 'Tactical AI',
              connections: 'Outputs to Coherence Analysis',
              detail: 'Q-Learning agent that processes match context and pattern data to generate tactical decisions. Sends formation, pressing, and tempo recommendations to Coherence Analysis for validation against the game model.',
            },
            {
              title: 'Coherence Analysis',
              connections: 'Outputs to Digital Twin and Recommendations',
              detail: 'Receives input from Pattern Recognition, Markov Chain, and Tactical AI. Scores game model adherence per player and per phase. Sends coherence scores to Digital Twin and tactical alerts to Recommendations.',
            },
            {
              title: 'Digital Twin',
              connections: 'Outputs to Recommendations',
              detail: 'Combines coherence scores with fatigue state to maintain behavioural models for each player. Tracks position deviation vectors, fatigue-adjusted expectations, and tactical compliance. Sends deviation alerts to Recommendations.',
            },
            {
              title: 'Recommendations',
              connections: 'Final output',
              detail: 'Aggregates alerts from Fatigue Model, Coherence Analysis, and Digital Twin into actionable intelligence. Outputs substitution timing, pressing adjustments, formation suggestions, and player-specific warnings.',
            },
          ].map((node) => (
            <div key={node.title} className="bg-[#111418] p-8">
              <h3 className="text-[#F6F7F9] text-base font-semibold mb-1">{node.title}</h3>
              <p className="text-[12px] text-[#5F6B7C] mb-3">{node.connections}</p>
              <p className="text-[#8F99A8] text-sm leading-relaxed">{node.detail}</p>
            </div>
          ))}
        </div>

        {/* Data flow summary */}
        <div className="mt-16 max-w-[700px]">
          <h3 className="text-[#F6F7F9] text-lg font-semibold mb-4">Data flow</h3>
          <p className="text-[#8F99A8] text-[15px] leading-relaxed">
            Ingestors produce normalized positional and physical data. The Pattern
            Recognition Engine and Fatigue Model process this data in parallel. Pattern
            sequences feed into Markov Chain analysis. The Tactical AI consumes pattern
            data to generate decisions. Coherence Analysis validates all inputs against
            the game model. The Digital Twin integrates coherence and fatigue data into
            per-player behavioural models. The Recommendations module aggregates all
            downstream alerts into a single actionable output stream.
          </p>
          <p className="text-[#8F99A8] text-[15px] leading-relaxed mt-4">
            Eight modules. Eleven directed connections. Each module processes only the
            data it needs and outputs only the data downstream modules consume.
          </p>
        </div>
      </div>
    </section>
  );
}

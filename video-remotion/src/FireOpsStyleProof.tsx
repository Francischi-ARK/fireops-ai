import { Audio } from "@remotion/media";
import { fade } from "@remotion/transitions/fade";
import { linearTiming } from "@remotion/transitions";
import { TransitionSeries } from "@remotion/transitions";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { EvidenceScene } from "./scenes/EvidenceScene";
import { HumanGateScene } from "./scenes/HumanGateScene";
import { SignalScene } from "./scenes/SignalScene";

export const FireOpsStyleProof: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#071018" }}>
    <Sequence from={8}>
      <Audio src={staticFile("audio/narration.m4a")} volume={0.9} />
    </Sequence>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={150}>
        <SignalScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence durationInFrames={180}>
        <EvidenceScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence durationInFrames={150}>
        <HumanGateScene />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);

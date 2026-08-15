import { Composition } from "remotion";
import { FireOpsDemo } from "./FireOpsDemo";
import { FireOpsStyleProof } from "./FireOpsStyleProof";

export const FireOpsComposition: React.FC = () => (
  <>
    <Composition id="FireOpsDemo" component={FireOpsDemo} durationInFrames={2700} fps={30} width={1920} height={1080} />
    <Composition id="FireOpsStyleProof" component={FireOpsStyleProof} durationInFrames={450} fps={30} width={1920} height={1080} />
  </>
);

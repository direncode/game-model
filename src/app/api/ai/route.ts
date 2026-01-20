// AI Processing API Route for Manager Instructions

import { NextRequest, NextResponse } from 'next/server';
import {
  processManagerInput,
  createVerificationRequest,
  applyInstructionsToGameModel,
  generateGameApproach,
  TACTICAL_AI_SYSTEM_PROMPT,
} from '@/lib/ai-manager-interface';
import type { Player, GameModel, ManagerInput } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'process-instruction': {
        const { input, players, currentGameModel } = data as {
          input: string;
          players: Player[];
          currentGameModel?: GameModel;
        };

        // Process the manager's natural language input
        const processed = processManagerInput(input, {
          players,
          currentGameModel,
        });

        // If confidence is low, create verification request
        let verificationRequest = null;
        if (processed.needsVerification) {
          verificationRequest = createVerificationRequest(processed);
        }

        return NextResponse.json({
          success: true,
          processed,
          verificationRequest,
          requiresVerification: processed.needsVerification,
        });
      }

      case 'apply-instructions': {
        const { gameModel, instructions } = data as {
          gameModel: GameModel;
          instructions: ManagerInput['processedInstructions'];
        };

        const updatedModel = applyInstructionsToGameModel(gameModel, instructions);

        return NextResponse.json({
          success: true,
          updatedModel,
        });
      }

      case 'generate-approach': {
        const { baseGameModel, opponentInfo, matchContext, instructions } = data as {
          baseGameModel: GameModel;
          opponentInfo: string;
          matchContext: string;
          instructions: ManagerInput['processedInstructions'];
        };

        const approach = generateGameApproach(
          baseGameModel,
          opponentInfo,
          matchContext,
          instructions
        );

        return NextResponse.json({
          success: true,
          approach,
        });
      }

      case 'get-system-prompt': {
        return NextResponse.json({
          success: true,
          systemPrompt: TACTICAL_AI_SYSTEM_PROMPT,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('AI API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

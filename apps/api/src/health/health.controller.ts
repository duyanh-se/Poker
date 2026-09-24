import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('operations')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check API availability' })
  @ApiOkResponse({
    description: 'The service is available.',
    schema: { example: { status: 'ok' } },
  })
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}

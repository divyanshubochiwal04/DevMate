import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TodoDependencyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Asserts that adding a dependency where `todoId` depends on `dependsOnTodoId` does not create a cycle.
   */
  async validateDependency(todoId: string, dependsOnTodoId: string): Promise<void> {
    if (todoId === dependsOnTodoId) {
      throw new BadRequestException('A task cannot depend on itself.');
    }

    // DFS starting from the blocker task (dependsOnTodoId) to check if the dependent task (todoId) is reachable.
    const visited = new Set<string>();
    const isReachable = await this.dfs(dependsOnTodoId, todoId, visited);

    if (isReachable) {
      throw new BadRequestException(
        `Circular dependency detected: Task cannot depend on this blocker because it would cause a deadlock.`
      );
    }
  }

  private async dfs(currentId: string, targetId: string, visited: Set<string>): Promise<boolean> {
    if (currentId === targetId) {
      return true;
    }
    if (visited.has(currentId)) {
      return false;
    }
    visited.add(currentId);

    // Fetch all tasks that the current task depends on (blocked by)
    const dependencies = await this.prisma.todoDependency.findMany({
      where: { todoId: currentId },
    });

    for (const dep of dependencies) {
      const found = await this.dfs(dep.dependsOnTodoId, targetId, visited);
      if (found) {
        return true;
      }
    }

    return false;
  }
}

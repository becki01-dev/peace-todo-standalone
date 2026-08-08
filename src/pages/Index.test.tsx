import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Index from "./Index";
import type { Task } from "@/types/task";

const { TEST_USER } = vi.hoisted(() => ({
  TEST_USER: { id: "user-1", email: "tester@example.com" },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        cb("INITIAL_SESSION", { user: TEST_USER });
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: TEST_USER } } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(),
  },
}));

/**
 * Builds a chainable supabase query mock.
 * `p` is a Promise (final await target) that also carries the chain methods,
 * so `.select().eq().order()` all return `p` and the last `await` resolves to `resolveValue`.
 */
function buildChain(resolveValue: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock is a hybrid promise+chain object
  const p: any = Promise.resolve(resolveValue);
  p.select = vi.fn().mockReturnValue(p);
  p.eq = vi.fn().mockReturnValue(p);
  p.order = vi.fn().mockReturnValue(p);
  p.update = vi.fn().mockReturnValue(p);
  p.delete = vi.fn().mockReturnValue(p);
  p.insert = vi.fn().mockResolvedValue({ error: null });
  return p;
}

function setupClient(tasks: Task[]) {
  const chain = buildChain({ data: tasks, error: null });
  vi.mocked(supabase.from).mockReturnValue(chain);
  return chain;
}

const makeTask = (overrides: Partial<Task>): Task => ({
  id: "t1",
  user_id: TEST_USER.id,
  title: "测试任务",
  description: null,
  priority: "medium",
  due_date: null,
  is_completed: false,
  created_at: "2026-08-08T10:00:00Z",
  updated_at: "2026-08-08T10:00:00Z",
  ...overrides,
});

const renderIndex = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <Index />
      </AuthProvider>
    </MemoryRouter>
  );

describe("Index (ZenTask)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders tasks loaded from supabase", async () => {
    const tasks = [
      makeTask({ id: "a", title: "买菜", is_completed: false }),
      makeTask({ id: "b", title: "写代码", is_completed: true }),
    ];
    setupClient(tasks);

    renderIndex();

    expect(await screen.findByText("买菜")).toBeInTheDocument();
    expect(screen.getByText("写代码")).toBeInTheDocument();
  });

  it("marks a task complete via update", async () => {
    const tasks = [makeTask({ id: "a", title: "买菜", is_completed: false })];
    const chain = setupClient(tasks);

    renderIndex();

    const toggle = await screen.findByRole("button", { name: "标记为已完成" });
    fireEvent.click(toggle);

    await waitFor(() => expect(chain.update).toHaveBeenCalledWith({ is_completed: true }), { timeout: 2000 });
    expect(chain.eq).toHaveBeenCalledWith("id", "a");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "标记为未完成" })).toBeInTheDocument()
    );
  });

  it("reverts optimistic toggle when update fails", async () => {
    const tasks = [makeTask({ id: "a", title: "买菜", is_completed: false })];
    const chain = setupClient(tasks);
    chain.update.mockReturnValue(buildChain({ data: [], error: { message: "boom" } }));

    renderIndex();

    const toggle = await screen.findByRole("button", { name: "标记为已完成" });
    fireEvent.click(toggle);

    await waitFor(() => expect(chain.update).toHaveBeenCalled(), { timeout: 2000 });
    // fetchTasks is re-run after failure -> toggle back to unchecked
    await waitFor(
      () => expect(screen.getByRole("button", { name: "标记为已完成" })).toBeInTheDocument(),
      { timeout: 2000 }
    );
  });

  it("deletes a task and removes it from the list", async () => {
    const tasks = [makeTask({ id: "a", title: "买菜", is_completed: false })];
    const chain = setupClient(tasks);

    renderIndex();

    const del = await screen.findByRole("button", { name: "删除" });
    fireEvent.click(del);

    await waitFor(() => expect(chain.delete).toHaveBeenCalled());
    expect(chain.eq).toHaveBeenCalledWith("id", "a");
    await waitFor(() => expect(screen.queryByText("买菜")).not.toBeInTheDocument());
  });

  it("filters tasks by completed tab", async () => {
    const tasks = [
      makeTask({ id: "a", title: "待办A", is_completed: false }),
      makeTask({ id: "b", title: "完成B", is_completed: true }),
    ];
    setupClient(tasks);

    renderIndex();
    await screen.findByText("待办A");

    fireEvent.click(screen.getByRole("tab", { name: /已完成/ }));

    expect(screen.queryByText("待办A")).not.toBeInTheDocument();
    expect(screen.getByText("完成B")).toBeInTheDocument();
  });
});

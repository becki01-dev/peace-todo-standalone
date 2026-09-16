// 只读动作参考页测试:默认列表、部位/肌肉筛选、搜索与空态
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import FitExerciseLibrary from "./FitExerciseLibrary";

vi.mock("../useExerciseDict", () => ({
  useExerciseDict: () => ({
    dict: { aliases: {}, en: {}, zhAliases: {} },
    rows: [],
    loading: false,
    isAdmin: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("../useExerciseHistory", () => {
  const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
  return {
    useExerciseHistory: () => ({
      lastUsed: new Map([
        ["臀推", daysAgo(2)],
        ["卧推", daysAgo(10)],
        ["髋外展", daysAgo(40)],
        ["引体向上", daysAgo(1)],
      ]),
      usage: new Map([
        ["臀推", { count: 3, lastUsed: daysAgo(2) }],
        ["卧推", { count: 5, lastUsed: daysAgo(10) }],
        ["髋外展", { count: 2, lastUsed: daysAgo(40) }],
        ["引体向上", { count: 4, lastUsed: daysAgo(1) }],
        ["哈克深蹲", { count: 7, lastUsed: daysAgo(1) }],
      ]),
      knownNames: ["臀推", "卧推", "髋外展", "引体向上", "哈克深蹲"],
      loading: false,
    }),
  };
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <FitExerciseLibrary />
    </MemoryRouter>,
  );

const SessionProbe = () => {
  const location = useLocation();
  return <div>SESSION_STATE:{JSON.stringify(location.state)}</div>;
};

describe("FitExerciseLibrary", () => {
  it("默认展示全部动作,动作卡含中英文与主要肌肉", () => {
    renderPage();
    expect(screen.getByText("臀推")).toBeInTheDocument();
    expect(screen.getByText("Hip Thrust")).toBeInTheDocument();
    expect(screen.getAllByText("臀大肌").length).toBeGreaterThan(0);
  });

  it("点臀部后只看臀部动作,再点臀中肌只看臀中肌动作", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^臀/ }));
    expect(screen.getByText("臀桥")).toBeInTheDocument();
    expect(screen.getByText("髋外展")).toBeInTheDocument();
    expect(screen.queryByText("卧推")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /臀中肌/ }));
    expect(screen.getByText("蚌式")).toBeInTheDocument();
    expect(screen.queryByText("臀推")).not.toBeInTheDocument();
  });

  it("点胸再点中胸后只显示中胸动作", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^胸/ }));
    fireEvent.click(screen.getByRole("button", { name: /中胸/ }));
    expect(screen.getByText("卧推")).toBeInTheDocument();
    expect(screen.getByText("哑铃卧推")).toBeInTheDocument();
    expect(screen.queryByText("上斜卧推")).not.toBeInTheDocument();
  });

  it("搜索 hip thrust 命中臀推,搜不到时给空态", () => {
    renderPage();
    const input = screen.getByLabelText("搜索动作或肌肉");
    fireEvent.change(input, { target: { value: "hip thrust" } });
    expect(screen.getByText("臀推")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "不存在的动作xyz" } });
    expect(screen.getByText(/没有匹配的动作/)).toBeInTheDocument();
  });

  it("显示最近练过/很久没练标记", () => {
    renderPage();
    expect(screen.getAllByText("7 天内练过").length).toBeGreaterThan(0);
    expect(screen.getByText("30 天内练过")).toBeInTheDocument();
    expect(screen.getByText("30 天没练")).toBeInTheDocument();
  });

  it("隐藏 7 天内练过的动作", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "隐藏 7 天内练过" }));
    expect(screen.queryByText("臀推")).not.toBeInTheDocument();
    expect(screen.getByText("髋外展")).toBeInTheDocument();
  });
  it("选择动作后开始训练,把动作名带到会话页", () => {
    render(
      <MemoryRouter initialEntries={["/fit/library"]}>
        <Routes>
          <Route path="/fit/library" element={<FitExerciseLibrary />} />
          <Route path="/fit/strength/session" element={<SessionProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /加入 臀推/ }));
    expect(screen.getByText(/已选 1 个动作/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "开始训练" }));
    expect(screen.getByText(/SESSION_STATE:/)).toHaveTextContent("臀推");
  });

  it("默认列表加入历史动作,匹配不到标准动作时显示提示", () => {
    renderPage();
    expect(screen.getByText("哈克深蹲")).toBeInTheDocument();
    expect(screen.getByText("历史动作")).toBeInTheDocument();
    expect(screen.getByText(/暂无细分肌群信息/)).toBeInTheDocument();
  });

  it("历史动作匹配到标准动作时使用 catalog 的肌肉/器械/要点", () => {
    renderPage();
    const card = screen.getByText("引体向上").closest("li");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText("背阔肌")).toBeInTheDocument();
    expect(within(card as HTMLElement).getByText("自重")).toBeInTheDocument();
  });

  it("点部位筛选时,未匹配的历史动作不参与肌肉筛选", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^背/ }));
    expect(screen.getByText("引体向上")).toBeInTheDocument();
    expect(screen.queryByText("哈克深蹲")).not.toBeInTheDocument();
  });

  it("我练过的筛选只显示有历史记录的动作", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /我练过的/ }));
    expect(screen.getByText("臀推")).toBeInTheDocument();
    expect(screen.getByText("哈克深蹲")).toBeInTheDocument();
    expect(screen.queryByText("硬拉")).not.toBeInTheDocument();
  });

  it("只看没练过时隐藏历史动作", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "只看没练过" }));
    expect(screen.getByText("硬拉")).toBeInTheDocument();
    expect(screen.queryByText("臀推")).not.toBeInTheDocument();
    expect(screen.queryByText("哈克深蹲")).not.toBeInTheDocument();
  });

  it("历史动作也能加入本次训练", () => {
    render(
      <MemoryRouter initialEntries={["/fit/library"]}>
        <Routes>
          <Route path="/fit/library" element={<FitExerciseLibrary />} />
          <Route path="/fit/strength/session" element={<SessionProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /加入 哈克深蹲/ }));
    expect(screen.getByText(/已选 1 个动作/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "开始训练" }));
    expect(screen.getByText(/SESSION_STATE:/)).toHaveTextContent("哈克深蹲");
  });

});

// 只读动作参考页测试:默认列表、部位/肌肉筛选、搜索与空态
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
});
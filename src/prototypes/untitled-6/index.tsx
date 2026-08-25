/**
 * @name 语义解析
 */
import React from 'react';
import './style.css';

type SemanticRow = {
    field: string;
    required: string;
    defaultValue: string;
    userSpeech: string;
    singleQuestion: string;
    multipleQuestion: string;
    highlighted?: boolean;
};

const rows: SemanticRow[] = [
    {
        field: '生成周期', required: '必填项', defaultValue: '-',
        userSpeech: '解析为：开始日期~结束日期',
        singleQuestion: '时间超出四周：\n请问要生成哪个时间段内的菜单？生成周期请选择6月1日至6月28日之间的', multipleQuestion: '',
    },
    {
        field: '餐段', required: '必填项', defaultValue: '生成周期内的全部可用餐段（排产后台配置的）',
        userSpeech: '用户说设置餐段->生成的菜单，按后台配置的，周期内全部可用餐段生成菜单\n\n用户有说餐段->生成的菜单，按后台配置的，周期内指定餐段才生成菜单\n（如果未指指定餐段不存在，则那天跳过该餐段）',
        singleQuestion: '请问要生成哪些餐段的菜单？',
        multipleQuestion: '我还需要以下信息才能生成菜单\n1.请问要生成哪个时间段内的菜单？生成周期请选择6月1日至6月28日之间的\n2.请问要生成哪些餐段的菜单？\n3.请问午餐、晚餐的餐品数量是多少？\n4.请问大荤、小荤、蔬菜的比例是多少？',
    },
    {
        field: '餐品数量', required: '必填项', defaultValue: '-',
        userSpeech: '每个餐段都需要一个餐品数量\n生成的餐段只有1个，用户说了1个数字->匹配该餐段的餐品数量\n生成的餐段有多个，用户说了1个数字->匹配每个餐段的餐品数量是同一个',
        singleQuestion: '生成周期内，只要有一个餐段的数量不明确，语料中的餐段为生成周期内的全部可用餐段：请问午餐、晚餐的餐品数量是多少？', multipleQuestion: '',
    },
    {
        field: '大荤小荤蔬菜比例', required: '必填项', defaultValue: '-',
        userSpeech: '需要3个数字\n用户说了荤菜比例，文字+数字->自动匹配大荤、小荤、蔬菜的比例\n用户说了荤菜比例，只有数字->依次填充为大荤、小荤、蔬菜的比例',
        singleQuestion: '只有一个分类的数量不明确：请问大荤、小荤、蔬菜的比例是多少？', multipleQuestion: '',
    },
    {
        field: '菜系', required: '非必填项', defaultValue: '无，不选择任何菜系',
        userSpeech: '用户没说指定菜系->生成的菜单包含任意菜系\n用户有说指定菜系->生成的菜单全是指定菜系',
        singleQuestion: '请问您对菜系有要求吗？', multipleQuestion: '',
    },
    {
        field: '口味', required: '非必填项', defaultValue: '无，不选择任何口味',
        userSpeech: '用户没说指定口味->生成的菜单包含任意口味\n用户有说指定口味->生成的菜单全是指定口味',
        singleQuestion: '请问您对口味有要求吗？', multipleQuestion: '',
    },
    {
        field: '烹饪设备', required: '非必填项', defaultValue: '门店全部种类的烹饪设备',
        userSpeech: '用户没说指定烹饪设备->生成的菜单包含全部烹饪设备\n用户有说指定烹饪设备->生成的菜单全是指定烹饪设备',
        singleQuestion: '请问您对烹饪设备有要求吗？', multipleQuestion: '请问您对菜系、口味、烹饪设备、就餐人数有要求吗？',
    },
    {
        field: '就餐人数', required: '非必填项', defaultValue: '排产后台餐段设置里的就餐人数\n用户说的就餐人数优先级高于后台设置的就餐人数',
        userSpeech: '每个餐段都需要一个就餐人数\n用户没说就餐人数->生成的菜单就餐人数按后台的来\n用户有说就餐人数->生成的菜单就餐人数按用户指定的来',
        singleQuestion: '请问您对就餐人数有要求吗？', multipleQuestion: '',
    },
    {
        field: '菜单偏好', required: '必填项', defaultValue: '-',
        userSpeech: '用户需要选择效率还是口味', singleQuestion: '请问您更看重效率还是口味？', multipleQuestion: '',
    },
    {
        field: '烹饪时限', required: '非必填项', defaultValue: '-',
        userSpeech: '用户说需要在指定时间内完成烹饪，或未说明烹饪时限', singleQuestion: '请问您希望烹饪时限是多少分钟？', multipleQuestion: '', highlighted: true,
    },
    {
        field: '设备比例', required: '非必填项', defaultValue: '-',
        userSpeech: '用户没说设备比例->不加限制\n用户有说设备比例->生成的菜单餐品的设备比例按用户指定的来', singleQuestion: '请问xx设备、xx设备的菜品分配比例大概是多少？（在烹饪设备识别两个设备及以上时进行提问）', multipleQuestion: '', highlighted: true,
    },
    {
        field: '排产周期', required: '必填项', defaultValue: '-',
        userSpeech: '用户有说就餐人数->生成的菜单就餐人数按用户指定的来', singleQuestion: '请问您要生成哪个时间段内的排产计划？', multipleQuestion: '', highlighted: true,
    },
    {
        field: '批次', required: '非必填项，分批必填', defaultValue: '-',
        userSpeech: '用户需要说出对应批次名称', singleQuestion: '请说出你想要排产的批次', multipleQuestion: '', highlighted: true,
    },
    {
        field: '餐品名称', required: '非必填项，分批必填', defaultValue: '默认全部',
        userSpeech: '用户需要说出每个批次包含的餐品名称，名称个数需要和餐品数量保持一致，识别不清和少于数量都要追问补充', singleQuestion: '请分别说出每个批次的餐品名称', multipleQuestion: '', highlighted: true,
    },
    {
        field: '餐品数量', required: '非必填项，分批必填', defaultValue: '默认全部',
        userSpeech: '用户需要说出每个批次包含的餐品数量，数量需要≤菜单餐品数量', singleQuestion: '请分别说出每个批次的餐品数量', multipleQuestion: '', highlighted: true,
    },
];

const displayName = '语义解析';

export default function SemanticParsingTable() {
    return (
        <main className="table-page" aria-label={displayName}>
            <header className="page-header">
                <div className="breadcrumbs"><span></span><b></b><strong></strong></div>
            </header>

            <section className="table-shell">
                <div className="table-title-row">
                    <div>
                        <h1>将用户说的话，语义解析，转换成生成条件所需要的参数</h1>
                        <p>菜单生成条件包括时间周期、餐段、餐品数量、大荤小荤蔬菜比例、菜系、口味、烹饪设备、就餐人数、菜单偏好、烹饪时限（新增）、设备比例（新增）。<br />其中，菜系、口味、烹饪设备、就餐人数、烹饪时限、设备比例为非必填项，其余为必填项。<br />排产计划生成条件包括排产周期、批次、餐品名称、餐品数量。<br />其中，排产周期为必填项，批次、餐品名称、餐品数量为非必填项（分批时为必填项）</p>
                        <p>用户说完条件后，先解析必填项是不是全部都提及了，如果没有会一次性反问没有明确的必填项，直至所有必填项都明确了<br />如果必填项全部明确了，再一次性反问必选项，只问一次</p>
                        <p>有颜色标识的为新增内容</p>
                    </div>
                </div>

                <div className="view-tabs" aria-label="当前视图"><div className="active-tab"><span className="grid-symbol">▦</span> 表格视图</div></div>

                <div className="table-viewport">
                    <table className="semantic-table">
                        <colgroup><col className="page-column" /><col className="field-column" /><col className="required-column" /><col className="default-column" /><col className="speech-column" /><col className="single-column" /><col className="multiple-column" /></colgroup>
                        <thead><tr><th>页面</th><th>字段</th><th>性质</th><th>默认值</th><th>用户说话内容</th><th>解析后不明确，需要反问用户的语料（单一条件）</th><th>解析后不明确，需要反问用户的语料（多条件）</th></tr></thead>
                        <tbody>{rows.map((row, index) => <tr key={`${row.field}-${index}`} className={`${row.highlighted ? 'highlighted-row' : ''}${row.field === '烹饪时限' || row.field === '设备比例' ? ' cyan-row' : ''}`}>
                            {index === 0 && <td className="page-cell" rowSpan={11}>语音生成菜单</td>}
                            {index === 11 && <td className="page-cell" rowSpan={4}>智能排产</td>}
                            <td className="field-cell">{row.field}</td><td>{row.required}</td><td>{row.defaultValue}</td><td>{row.userSpeech}</td><td>{row.singleQuestion}</td><td>{row.multipleQuestion}</td>
                        </tr>)}</tbody>
                    </table>
                </div>
                <div className="table-footer"><span>共 {rows.length} 项语义解析字段</span><span>只读展示</span></div>
            </section>
        </main>
    );
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fillForm') {
        const data = request.data;
        if (!data) return;

        console.log("接收到简历数据，准备填充:", data);

        // 辅助函数：安全地设置 Element Plus 输入框的值
        const setElInputValue = (inputElement, value) => {
            // 使用 NativeInputValueSetter 绕过 Vue 属性拦截，确保能够正确修改值
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeInputValueSetter.call(inputElement, value);
            
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            inputElement.dispatchEvent(new Event('blur', { bubbles: true }));
        };

        // 定义字段映射
        const fieldMapping = {
            _NAME: data.name,
            _FLD_T_00002: data.phone,
            _FLD_T_00003: data.idNumber,
            _FLD_T_00005: data.school,
            _FLD_D_00004: data.graduationDate,
            _FLD_T_00006: data.degree,
            _FLD_T_00007: data.major,
            _FLD_N_00008: data.workExperienceYears
        };

        // 逐个填充输入框
        for (const id in fieldMapping) {
            const value = fieldMapping[id];
            if (value !== null && value !== undefined) {
                const formItem = document.getElementById(id);
                if (formItem) {
                    const inputElement = formItem.querySelector('input.el-input__inner');
                    if (inputElement) {
                        setElInputValue(inputElement, value);
                    }
                }
            }
        }

        // 特殊处理：性别下拉框
        if (data.gender) {
            const genderItem = document.getElementById('_FLD_S_00001');
            if (genderItem) {
                const genderInput = genderItem.querySelector('input.el-input__inner');
                if (genderInput) {
                    // 模拟点击打开下拉菜单
                    genderInput.click();
                    
                    // 延迟一点等待下拉列表渲染完成
                    setTimeout(() => {
                        const genderOptions = document.querySelectorAll('body .el-select-dropdown__item, body .select-tree__label');
                        const targetOption = Array.from(genderOptions).find(el => el.textContent.trim() === data.gender || el.title === data.gender);
                        if (targetOption) {
                            targetOption.click();
                        } else {
                            setElInputValue(genderInput, data.gender);
                        }
                    }, 200);
                }
            }
        }
        
        alert('简历信息已填充！');
        sendResponse({ success: true });
    }
    return true;
});